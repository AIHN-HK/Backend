import { Injectable } from '@nestjs/common';
import { hash, compare } from 'bcrypt';
@Injectable()
export class HashingService {
  async hash(data: string): Promise<string> {
    return await hash(data, 8);
  }

  async compare(data: string, hashedData: string): Promise<boolean> {
    return await compare(data, hashedData);
  }
}
