import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { processDocumentJob } from './workers.ts';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_CONCURRENCY = Number(process.env.QUEUE_CONCURRENCY) || 2;

const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

connection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

connection.on('connect', () => {
  console.log('Redis connected for BullMQ');
});

export const documentQueue = new Queue('document-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 min, 5 min, 15 min
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export const documentQueueEvents = new QueueEvents('document-processing', { connection });

documentQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`Job ${jobId} completed:`, returnvalue);
});

documentQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`Job ${jobId} failed:`, failedReason);
});

documentQueueEvents.on('stalled', ({ jobId }) => {
  console.warn(`Job ${jobId} stalled`);
});

documentQueueEvents.on('progress', ({ jobId, data }) => {
  console.log(`Job ${jobId} progress:`, data);
});

export async function enqueueDocumentJob(jobData: {
  userId: number;
  documentId: string;
  filename: string;
  fileType: string;
  storagePath: string;
  extractedText: string;
}): Promise<string> {
  const job = await documentQueue.add('process-document', jobData);
  return job.id!;
}

export async function startQueueWorker(): Promise<Worker> {
  await connection.connect();

  const worker = new Worker(
    'document-processing',
    async (job) => {
      return processDocumentJob(job.data);
    },
    {
      connection,
      concurrency: QUEUE_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Worker completed job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Worker job ${job?.id} failed:`, err);
  });

  console.log(`Document processing worker started with concurrency ${QUEUE_CONCURRENCY}`);
  return worker;
}

export async function closeQueue(): Promise<void> {
  await documentQueue.close();
  await documentQueueEvents.close();
  await connection.quit();
  console.log('Queue connections closed');
}