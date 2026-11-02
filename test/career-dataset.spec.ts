import { readCareerDataset } from '../scripts/import-career-data';
it('loads the pinned, checksum-verified sourced catalog with valid six-dimensional profiles', () => {
  const data = readCareerDataset();
  expect(data.careers).toHaveLength(923);
  expect(data.skills).toHaveLength(35);
  expect(data.careers.find((c) => c.id === '15-1252.00')?.title).toBe(
    'Software Developers',
  );
});
