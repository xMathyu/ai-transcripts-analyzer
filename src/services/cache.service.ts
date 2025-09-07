import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheItem<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache = new Map<string, CacheItem>();
  private readonly defaultTtl: number;

  constructor(private configService: ConfigService) {
    this.defaultTtl = this.configService.get<number>('CACHE_TTL', 3600) * 1000;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    const timestamp = Date.now();
    const expirationTime = ttl || this.defaultTtl;

    this.cache.set(key, {
      data,
      timestamp,
      ttl: expirationTime,
    });

    this.logger.debug(`Cache set: ${key}`);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.logger.debug(`Cache expired and removed: ${key}`);
      return null;
    }

    this.logger.debug(`Cache hit: ${key}`);
    return item.data as T;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);

    if (!item) {
      return false;
    }

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug(`Cache deleted: ${key}`);
    }
    return deleted;
  }

  clear(): void {
    this.cache.clear();
    this.logger.debug('Cache cleared');
  }

  cleanup(): number {
    const now = Date.now();
    let removedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.logger.debug(
        `Cache cleanup: removed ${removedCount} expired entries`,
      );
    }

    return removedCount;
  }

  getStats(): {
    size: number;
    keys: string[];
    memoryUsageEstimate: number;
  } {
    const keys = Array.from(this.cache.keys());

    let memoryUsageEstimate = 0;
    try {
      memoryUsageEstimate = JSON.stringify(
        Array.from(this.cache.values()).map((item) => item.data),
      ).length;
    } catch {
      memoryUsageEstimate = this.cache.size * 100;
    }

    return {
      size: this.cache.size,
      keys,
      memoryUsageEstimate,
    };
  }

  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}:${params[key]}`)
      .join('|');

    return `${prefix}:${sortedParams}`;
  }
}
