import PDFDocument from 'pdfkit';
import type { ReportDetails } from '../db/schema.ts';

export interface PdfExportDocumentInput {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  wordCount: number;
  status: string;
  engine: string;
  similarityScore: string | null;
  aiScore: string | null;
  reportSummary: string | null;
  reportDetails: ReportDetails | null;
  createdAt: Date;
  completedAt: Date | null;
}

export function generateReportPdfBuffer(docData: PdfExportDocumentInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `ObiReport Verification — ${docData.filename}`,
        Author: 'ObiReport Verification Platform',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const simScore = docData.similarityScore ? `${Number(docData.similarityScore).toFixed(1)}%` : 'N/A';
    const aiScore = docData.aiScore ? `${Number(docData.aiScore).toFixed(1)}%` : 'N/A';

    // Header
    doc.fillColor('#0F172A').fontSize(20).font('Helvetica-Bold').text('ObiReport', { continued: true });
    doc.fillColor('#64748B').fontSize(11).font('Helvetica').text('   Originality & AI Detection Certificate', {
      align: 'right',
    });

    doc.moveDown(0.5);
    doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(1);

    // Document Metadata
    doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text(docData.filename);
    doc.moveDown(0.3);
    doc
      .fillColor('#475569')
      .fontSize(9.5)
      .font('Helvetica')
      .text(
        `Report ID: ${docData.id}  |  Type: ${docData.fileType.toUpperCase()}  |  Words: ${docData.wordCount.toLocaleString()}  |  Engine: ${docData.reportDetails?.engineLabel || docData.engine}`
      );
    doc.text(
      `Submitted: ${new Date(docData.createdAt).toUTCString()}  |  Completed: ${
        docData.completedAt ? new Date(docData.completedAt).toUTCString() : 'In Progress'
      }`
    );

    doc.moveDown(1.2);

    // Score Summary Boxes
    const boxY = doc.y;
    doc.rect(50, boxY, 238, 72).fillAndStroke('#F8FAFC', '#CBD5E1');
    doc.rect(307, boxY, 238, 72).fillAndStroke('#F8FAFC', '#CBD5E1');

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('SIMILARITY INDEX', 66, boxY + 14);
    doc.fillColor('#0F172A').fontSize(26).font('Helvetica-Bold').text(simScore, 66, boxY + 30);

    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text('AI WRITING INDICATOR', 323, boxY + 14);
    doc.fillColor('#0F172A').fontSize(26).font('Helvetica-Bold').text(aiScore, 323, boxY + 30);

    doc.y = boxY + 90;

    // Executive Summary
    if (docData.reportDetails?.overallVerdict) {
      doc.fillColor('#1E293B').fontSize(11).font('Helvetica-Bold').text(`Verdict: ${docData.reportDetails.overallVerdict}`);
      doc.moveDown(0.4);
    }

    if (docData.reportSummary) {
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Executive Summary');
      doc.moveDown(0.3);
      doc.fillColor('#334155').fontSize(10).font('Helvetica').text(docData.reportSummary, { lineGap: 3 });
      doc.moveDown(0.8);
    }

    if (docData.reportDetails?.similaritySignalsSummary || docData.reportDetails?.aiSignalsSummary) {
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Forensic Signal Breakdown');
      doc.moveDown(0.3);
      if (docData.reportDetails.similaritySignalsSummary) {
        doc
          .fillColor('#334155')
          .fontSize(9.5)
          .font('Helvetica')
          .text(`Similarity Signals: ${docData.reportDetails.similaritySignalsSummary}`, { lineGap: 2 });
        doc.moveDown(0.3);
      }
      if (docData.reportDetails.aiSignalsSummary) {
        doc
          .fillColor('#334155')
          .fontSize(9.5)
          .font('Helvetica')
          .text(`AI Stylometry Signals: ${docData.reportDetails.aiSignalsSummary}`, { lineGap: 2 });
      }
      doc.moveDown(0.8);
    }

    // Section Breakdown
    const sections = docData.reportDetails?.sectionBreakdown || [];
    if (sections.length > 0) {
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Section-by-Section Analysis');
      doc.moveDown(0.4);
      for (const sec of sections) {
        if (doc.y > 720) doc.addPage();
        doc
          .fillColor('#0F172A')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(
            `${sec.section} — Similarity: ${sec.similarityPercent.toFixed(1)}%  |  AI Likelihood: ${sec.aiPercent.toFixed(1)}%`
          );
        doc.fillColor('#475569').fontSize(9.5).font('Helvetica').text(sec.notes, { lineGap: 2 });
        doc.moveDown(0.45);
      }
      doc.moveDown(0.5);
    }

    // Flagged Passages
    const passages = docData.reportDetails?.flaggedPassages || [];
    if (passages.length > 0) {
      if (doc.y > 680) doc.addPage();
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Flagged Passages');
      doc.moveDown(0.4);
      passages.forEach((p, idx) => {
        if (doc.y > 700) doc.addPage();
        const catLabel =
          p.category === 'similarity_match'
            ? 'Similarity Match'
            : p.category === 'citation_gap'
              ? 'Citation Gap'
              : 'AI Pattern';
        doc
          .fillColor('#1D4ED8')
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .text(`${idx + 1}. ${catLabel} (${p.confidence.toFixed(0)}% confidence) — ${p.sourceHint}`);
        doc.fillColor('#0F172A').fontSize(9.5).font('Helvetica-Oblique').text(`"${p.excerpt}"`, { lineGap: 2 });
        doc.fillColor('#475569').fontSize(9).font('Helvetica').text(p.explanation, { lineGap: 2 });
        doc.moveDown(0.5);
      });
    }

    // Recommendations
    const recs = docData.reportDetails?.recommendations || [];
    if (recs.length > 0) {
      if (doc.y > 700) doc.addPage();
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Editorial Recommendations');
      doc.moveDown(0.4);
      recs.forEach((r, idx) => {
        doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(`${idx + 1}. ${r}`, { lineGap: 2 });
        doc.moveDown(0.25);
      });
    }

    doc.end();
  });
}
