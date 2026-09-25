export class CursorDto {
  cursorCreatedAt!: string;
  cursorId!: number;
}

export class PageInfoDto {
  hasNext!: boolean;
  nextCursor!: CursorDto | null;
}
