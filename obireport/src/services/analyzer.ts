import { GoogleGenAI, Type } from '@google/genai';
import type { ReportDetails } from '../db/schema.ts';
import { getStoredFileBuffer } from './extraction.ts';

export interface AnalysisOutput {
  engine: 'turnitin_api' | 'forensic_ai';
  similarityScore: number;
  aiScore: number;
  reportSummary: string;
  reportDetails: ReportDetails;
  turnitinSubmissionId?: string | null;
  turnitinReportUrl?: string | null;
}

export function isTurnitinConfigured(): boolean {
  return Boolean(process.env.TURNITIN_API_URL?.trim() && process.env.TURNITIN_API_KEY?.trim());
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function runTurnitinIntegration(params: {
  userId: number;
  filename: string;
  storagePath: string;
  fileType: string;
}): Promise<AnalysisOutput> {
  const baseUrl = process.env.TURNITIN_API_URL!.replace(/\/+$/, '');
  const apiKey = process.env.TURNITIN_API_KEY!;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'X-Turnitin-Integration-Name': 'ObiReport',
    'X-Turnitin-Integration-Version': '1.0.0',
  };

  // 1. Create submission
  const createRes = await fetch(`${baseUrl}/api/v1/submissions`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      owner: `user_${params.userId}`,
      title: params.filename,
      submitter: `user_${params.userId}`,
      owner_default_permission_set: 'USER',
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Turnitin submission failed (${createRes.status}): ${errText.slice(0, 200)}`);
  }

  const submission = (await createRes.json()) as { id: string };
  const submissionId = submission.id;

  // 2. Upload file content - fetch from R2
  const fileBuffer = await getStoredFileBuffer(params.storagePath);
  const uploadRes = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/original`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'binary/octet-stream',
      'Content-Disposition': `inline; filename="${params.filename.replace(/"/g, '')}"`,
    },
    body: new Uint8Array(fileBuffer),
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Turnitin file upload failed (${uploadRes.status}): ${errText.slice(0, 200)}`);
  }

  // 3. Request similarity report
  const simReqRes = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/similarity`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      generation_settings: {
        search_repositories: ['INTERNET', 'SUBMITTED_WORK', 'PUBLICATION'],
      },
    }),
  });

  if (!simReqRes.ok) {
    const errText = await simReqRes.text();
    throw new Error(`Turnitin similarity generation failed (${simReqRes.status}): ${errText.slice(0, 200)}`);
  }

  // 4. Poll for completion (bounded polling up to 60s)
  let similarityPercent = 0;
  let aiPercent = 0;
  let reportReady = false;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const pollRes = await fetch(`${baseUrl}/api/v1/submissions/${submissionId}/similarity`, {
      headers,
    });
    if (!pollRes.ok) continue;
    const simData = (await pollRes.json()) as {
      status?: string;
      overall_match_percentage?: number;
      ai_writing_percentage?: number;
    };
    if (simData.status === 'COMPLETE') {
      similarityPercent = Number(simData.overall_match_percentage ?? 0);
      aiPercent = Number(simData.ai_writing_percentage ?? 0);
      reportReady = true;
      break;
    }
  }

  if (!reportReady) {
    throw new Error('Turnitin report generation timed out. Please retry verification.');
  }

  return {
    engine: 'turnitin_api',
    similarityScore: Math.min(100, Math.max(0, similarityPercent)),
    aiScore: Math.min(100, Math.max(0, aiPercent)),
    turnitinSubmissionId: submissionId,
    turnitinReportUrl: `${baseUrl}/api/v1/submissions/${submissionId}/viewer-url`,
    reportSummary: `Turnitin Core API verification completed with ${similarityPercent.toFixed(1)}% overall similarity and ${aiPercent.toFixed(1)}% AI writing indicator.`,
    reportDetails: {
      engineLabel: 'Turnitin Core API',
      overallVerdict:
        similarityPercent < 15 && aiPercent < 20
          ? 'Low Risk — Within standard academic thresholds'
          : similarityPercent < 35 && aiPercent < 45
            ? 'Moderate Risk — Review flagged citations and phrasing'
            : 'High Risk — Significant overlap or synthetic writing markers detected',
      aiSignalsSummary: `Turnitin AI writing detection reported ${aiPercent.toFixed(1)}% across eligible prose.`,
      similaritySignalsSummary: `Turnitin cross-repository index reported ${similarityPercent.toFixed(1)}% matched text.`,
      sectionBreakdown: [],
      flaggedPassages: [],
      recommendations: [
        'Open the full Turnitin viewer report to inspect source-by-source matches.',
        'Verify direct quotations are enclosed in quotation marks with page/author citations.',
      ],
    },
  };
}

async function runGeminiForensicAnalysis(params: {
  userId: number;
  filename: string;
  fileType: string;
  storagePath: string;
  extractedText: string;
}): Promise<AnalysisOutput> {
  const ai = getGeminiClient();

  const systemInstruction = `You are the ObiReport Academic Integrity & Forensic Stylometry Analyzer.
Analyze the submitted document objectively for two distinct dimensions:
1. Similarity & Originality Risk (similarityScore 0-100): Assess likelihood of unattributed copied prose, standard boilerplate/textbook phrasing, missing citations for factual claims, inconsistent register shifts, or verbatim-style academic phrasing.
2. AI Writing Likelihood (aiScore 0-100): Assess stylometric signals including sentence length uniformity (low burstiness), predictable transitional scaffolding ("Moreover,", "Furthermore,", "In conclusion,"), symmetric listicle paragraphs, generic hedging, and lack of idiosyncratic human voice or concrete empirical specificity.

Ground every flagged passage directly in verbatim excerpts from the submitted document. Keep scores realistic, well-calibrated, and strictly evidence-based.`;

  const promptText = `Analyze the document "${params.filename}" (${params.fileType.toUpperCase()}) and return a complete forensic similarity and AI-detection report.`;

  let contents: string | { parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> };

  if (params.extractedText && params.extractedText.trim().length >= 80) {
    contents = `${promptText}\n\n--- DOCUMENT TEXT START ---\n${params.extractedText.slice(0, 60000)}\n--- DOCUMENT TEXT END ---`;
  } else if (params.fileType === 'pdf') {
    const fileBuffer = await getStoredFileBuffer(params.storagePath);
    contents = {
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBuffer.toString('base64'),
          },
        },
        { text: promptText },
      ],
    };
  } else {
    contents = `${promptText}\n\n--- DOCUMENT TEXT START ---\n${params.extractedText || '(No readable text extracted)'}\n--- DOCUMENT TEXT END ---`;
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          similarityScore: {
            type: Type.NUMBER,
            description: 'Estimated similarity/unattributed overlap risk percentage from 0 to 100.',
          },
          aiScore: {
            type: Type.NUMBER,
            description: 'Estimated AI-generated writing likelihood percentage from 0 to 100.',
          },
          reportSummary: {
            type: Type.STRING,
            description: '2-3 sentence executive summary of findings.',
          },
          overallVerdict: {
            type: Type.STRING,
            description: 'Short verdict label such as Low Risk, Moderate Risk, or High Risk with one-line rationale.',
          },
          aiSignalsSummary: {
            type: Type.STRING,
            description: 'Concise analysis of stylometric burstiness, phrasing uniformity, and AI markers.',
          },
          similaritySignalsSummary: {
            type: Type.STRING,
            description: 'Concise analysis of citation integrity, register shifts, and overlap risk.',
          },
          sectionBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                section: { type: Type.STRING },
                similarityPercent: { type: Type.NUMBER },
                aiPercent: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
              required: ['section', 'similarityPercent', 'aiPercent', 'notes'],
            },
          },
          flaggedPassages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                excerpt: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: 'Must be one of: ai_pattern, similarity_match, citation_gap',
                },
                confidence: { type: Type.NUMBER },
                sourceHint: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['excerpt', 'category', 'confidence', 'sourceHint', 'explanation'],
            },
          },
          recommendations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'similarityScore',
          'aiScore',
          'reportSummary',
          'overallVerdict',
          'aiSignalsSummary',
          'similaritySignalsSummary',
          'sectionBreakdown',
          'flaggedPassages',
          'recommendations',
        ],
      },
    },
  });

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('Analysis model returned an empty response.');
  }

  const parsed = JSON.parse(rawJson) as {
    similarityScore: number;
    aiScore: number;
    reportSummary: string;
    overallVerdict: string;
    aiSignalsSummary: string;
    similaritySignalsSummary: string;
    sectionBreakdown: ReportDetails['sectionBreakdown'];
    flaggedPassages: Array<{
      excerpt: string;
      category: string;
      confidence: number;
      sourceHint: string;
      explanation: string;
    }>;
    recommendations: string[];
  };

  const clampScore = (v: number) => Math.round(Math.min(100, Math.max(0, Number(v) || 0)) * 100) / 100;

  return {
    engine: 'forensic_ai',
    similarityScore: clampScore(parsed.similarityScore),
    aiScore: clampScore(parsed.aiScore),
    reportSummary: parsed.reportSummary,
    reportDetails: {
      engineLabel: 'ObiReport Forensic AI & Stylometry Engine',
      overallVerdict: parsed.overallVerdict,
      aiSignalsSummary: parsed.aiSignalsSummary,
      similaritySignalsSummary: parsed.similaritySignalsSummary,
      sectionBreakdown: (parsed.sectionBreakdown || []).slice(0, 8).map((sec) => ({
        section: sec.section,
        similarityPercent: clampScore(sec.similarityPercent),
        aiPercent: clampScore(sec.aiPercent),
        notes: sec.notes,
      })),
      flaggedPassages: (parsed.flaggedPassages || []).slice(0, 12).map((p) => ({
        excerpt: p.excerpt,
        category:
          p.category === 'similarity_match' || p.category === 'citation_gap'
            ? p.category
            : 'ai_pattern',
        confidence: clampScore(p.confidence),
        sourceHint: p.sourceHint,
        explanation: p.explanation,
      })),
      recommendations: (parsed.recommendations || []).slice(0, 6),
    },
  };
}

export async function analyzeDocumentContent(params: {
  userId: number;
  filename: string;
  fileType: string;
  storagePath: string;
  extractedText: string;
}): Promise<AnalysisOutput> {
  if (isTurnitinConfigured()) {
    return runTurnitinIntegration(params);
  }
  return runGeminiForensicAnalysis(params);
}