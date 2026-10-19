/** Date of birth is a calendar date; UTC avoids server timezone drift. */
export function calculateAge(birth: Date, today = new Date()): number {
  if (!Number.isFinite(birth.getTime()) || birth > today)
    throw new Error('Invalid date of birth');
  const birthdayPending =
    today.getUTCMonth() < birth.getUTCMonth() ||
    (today.getUTCMonth() === birth.getUTCMonth() &&
      today.getUTCDate() < birth.getUTCDate());
  return (
    today.getUTCFullYear() - birth.getUTCFullYear() - Number(birthdayPending)
  );
}
