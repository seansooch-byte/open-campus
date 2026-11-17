import type { CardState } from './fsrs.js';

export type AnswerRecord = { choice: 'A' | 'B' | 'C' | 'D'; correct: boolean; at: string };

export interface ProgressStore {
  getCard(id: string): Promise<CardState | undefined>;
  putCard(id: string, state: CardState): Promise<void>;
  listDue(now: Date): Promise<string[]>;
  getAnswer(qid: string): Promise<AnswerRecord | undefined>;
  putAnswer(qid: string, record: AnswerRecord): Promise<void>;
}

export class MemoryProgressStore implements ProgressStore {
  private cards = new Map<string, CardState>();
  private answers = new Map<string, AnswerRecord>();
  async getCard(id: string) { return this.cards.get(id); }
  async putCard(id: string, state: CardState) { this.cards.set(id, state); }
  async listDue(now: Date) {
    return [...this.cards].filter(([, c]) => c.due.getTime() <= now.getTime()).map(([id]) => id).sort();
  }
  async getAnswer(qid: string) { return this.answers.get(qid); }
  async putAnswer(qid: string, record: AnswerRecord) { this.answers.set(qid, record); }
}

const CARDS = 'cards';
const ANSWERS = 'answers';

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** Minimal raw-IndexedDB store. TODO: versioned migrations once the record shapes settle. */
export class IndexedDbProgressStore implements ProgressStore {
  private db: Promise<IDBDatabase> | undefined;
  constructor(private name = 'open-campus-progress') {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(CARDS);
        req.result.createObjectStore(ANSWERS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  }

  private async store(name: string, mode: IDBTransactionMode) {
    return (await this.open()).transaction(name, mode).objectStore(name);
  }

  /** Resolve only once the readwrite transaction has durably committed. */
  private async write(name: string, key: string, value: unknown): Promise<void> {
    const tx = (await this.open()).transaction(name, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.objectStore(name).put(value, key);
    });
  }

  async getCard(id: string) { return request<CardState | undefined>((await this.store(CARDS, 'readonly')).get(id)); }
  async putCard(id: string, state: CardState) { await this.write(CARDS, id, state); }
  async listDue(now: Date) {
    const s = await this.store(CARDS, 'readonly');
    const [keys, values] = await Promise.all([request(s.getAllKeys()), request<CardState[]>(s.getAll())]);
    return keys.map((k, i) => [String(k), values[i]!] as const)
      .filter(([, c]) => c.due.getTime() <= now.getTime()).map(([k]) => k).sort();
  }
  async getAnswer(qid: string) { return request<AnswerRecord | undefined>((await this.store(ANSWERS, 'readonly')).get(qid)); }
  async putAnswer(qid: string, record: AnswerRecord) { await this.write(ANSWERS, qid, record); }
}
