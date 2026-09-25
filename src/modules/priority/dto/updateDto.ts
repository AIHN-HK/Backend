import { IsInt } from 'class-validator';

export class UpdatePriorityDto {
  @IsInt()
  id: number;
  @IsInt()
  priority: number;
}
