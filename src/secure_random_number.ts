import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bigInt from 'big-integer';
import { createHash, randomBytes } from 'crypto';
import { asyncSettings } from './config';
import { logger } from './helper/logger';
const prisma = new PrismaClient();

interface DrandResponse {
  round: number;
  randomness: string;
  signature: string;
}

interface EntropyData {
  drandCurrent: DrandResponse;
  drandPrevious: DrandResponse;
  hardware: Buffer;
  system: Buffer;
}

export interface AuditRecord {
  id: number;
  timestamp: number;
  drandRounds: {
    current: number;
    previous: number;
  };
  commitment: string | null;
  result?: number;
  vdfHash?: string;
}

export interface RandomResult {
  number: number;
  auditRecord: AuditRecord;
}

export class SecureRandomGenerator {
  private currentCommitment!: string | null;
  private commitmentSalt!: Buffer | null;
  private readonly PRIME_2048 = bigInt('2').pow(2048).subtract(1);
  private readonly RSW_SETUP_BASE = bigInt('2');

  constructor(
    currentCommitment: string | null = null,
    commitmentSalt: Buffer | null = null
  ) {
    if (
      currentCommitment &&
      commitmentSalt &&
      this.verifyCommitment(currentCommitment, commitmentSalt)
    ) {
      this.currentCommitment = currentCommitment;
      this.commitmentSalt = commitmentSalt;
    } else {
      this.generateCommitment();
    }
  }

  private verifyCommitment(commitment: string, salt: Buffer): boolean {
    if (!commitment || !salt) {
      return false;
    }

    if (!Buffer.isBuffer(salt) || salt.length !== 32) {
      return false;
    }

    const sha256Regex = /^[a-f0-9]{64}$/i;
    if (!sha256Regex.test(commitment)) {
      return false;
    }

    return true;
  }

  public generateCommitment(): string {
    this.commitmentSalt = randomBytes(32);
    const timestamp = Date.now().toString();
    const commitmentData = Buffer.concat([
      this.commitmentSalt,
      Buffer.from(timestamp),
    ]);
    this.currentCommitment = createHash('sha256')
      .update(commitmentData)
      .digest('hex');

    return this.currentCommitment;
  }

  // Wesolowski's VDF
  private vdf(input: Buffer | string, iterations: number): string {
    let x = bigInt(
      Buffer.isBuffer(input) ? input.toString('hex') : input,
      16
    ).mod(this.PRIME_2048);

    for (let i = 0; i < iterations; i++) {
      x = x.multiply(x).mod(this.PRIME_2048);
    }

    const l = bigInt(iterations);
    const proof = this.RSW_SETUP_BASE.modPow(x.divide(l), this.PRIME_2048);

    const result = {
      y: x.toString(16),
      proof: proof.toString(16),
      iterations: iterations,
    };

    return createHash('sha256').update(JSON.stringify(result)).digest('hex');
  }

  private gatherSystemEntropy(): Buffer {
    const cpuUsage = process.cpuUsage();
    const cpuUserEntropy = (cpuUsage.user >>> 0).toString();
    const cpuSystemEntropy = (cpuUsage.system >>> 0).toString();
    const timeEntropy = process.hrtime.bigint().toString();
    const memEntropy = process.memoryUsage().heapUsed.toString();
    const timestampEntropy = Date.now().toString();

    return createHash('sha256')
      .update(
        cpuUserEntropy +
          cpuSystemEntropy +
          timeEntropy +
          memEntropy +
          timestampEntropy
      )
      .digest();
  }

  private async gatherEntropy(): Promise<EntropyData> {
    try {
      // Distributed randomness
      const current = await axios.get<DrandResponse>(
        'https://api.drand.sh/public/latest'
      );
      const previous = await axios.get<DrandResponse>(
        `https://api.drand.sh/public/${current.data.round - 1}`
      );

      if (current.data.round !== previous.data.round + 1) {
        throw new Error('Drand chain inconsistency detected');
      }

      const hardwareEntropy = randomBytes(32); // replace with actual hardware entropy in best case xd
      const systemEntropy = this.gatherSystemEntropy();

      return {
        drandCurrent: current.data,
        drandPrevious: previous.data,
        hardware: hardwareEntropy,
        system: systemEntropy,
      };
    } catch (error) {
      throw new Error(
        `Entropy gathering failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public async generateSecureRandom(
    min: number,
    max: number
  ): Promise<RandomResult> {
    try {
      if (!this.commitmentSalt) {
        throw new Error('No commitment generated. Call generateCommitment().');
      }

      const entropy = await this.gatherEntropy();

      const auditRecord: AuditRecord = {
        id: -1,
        timestamp: Date.now(),
        drandRounds: {
          current: entropy.drandCurrent.round,
          previous: entropy.drandPrevious.round,
        },
        commitment: this.currentCommitment,
      };

      const combinedEntropy = Buffer.concat([
        Buffer.from(entropy.drandCurrent.randomness, 'hex'),
        Buffer.from(entropy.drandPrevious.randomness, 'hex'),
        entropy.hardware,
        entropy.system,
        this.commitmentSalt,
      ]);

      const settings = await asyncSettings;

      const vdfResult = this.vdf(combinedEntropy, settings.vdfIterations);

      const range = BigInt(max - min + 1);
      const maxValue =
        (BigInt(1) << BigInt(64)) - ((BigInt(1) << BigInt(64)) % range);
      let randomValue: bigint;
      do {
        const hash = createHash('sha256').update(vdfResult).digest();
        randomValue = hash.readBigUInt64BE(0);
      } while (randomValue >= maxValue);

      const randomNumber = Number((randomValue % range) + BigInt(min));

      auditRecord.result = randomNumber;
      auditRecord.vdfHash = vdfResult;

      auditRecord.id = await this.storeAuditRecord(auditRecord);

      return {
        number: randomNumber,
        auditRecord,
      };
    } catch (error) {
      throw new Error(
        `Secure random generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  protected async storeAuditRecord(record: AuditRecord): Promise<number> {
    // Store in DB
    try {
      const result = await prisma.audit.create({
        data: {
          drandRoundsCurrent: record.drandRounds.current,
          drandRoundsPrevious: record.drandRounds.previous,
          commitment: record.commitment ?? '',
          result: record.result ?? -1,
          vdfHash: record.vdfHash ?? '',
        },
      });
      logger.info(`Stored audit record with ID ${result.id}`);
      await prisma.$disconnect();
      return result.id;
    } catch (error) {
      logger.error(error, 'Failed to store audit record');
      await prisma.$disconnect();
      return -1;
    }
  }
}
