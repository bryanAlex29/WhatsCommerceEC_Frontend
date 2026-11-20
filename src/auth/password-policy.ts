export const passwordPolicyMessage = 'Usa 8–128 caracteres, una mayúscula y un símbolo, sin espacios ni caracteres invisibles. Los números son opcionales.';
export function passwordChecks(value: string) {
  const length = [...value].length;
  return { length: length >= 8 && length <= 128, uppercase: /\p{Lu}/u.test(value), symbol: /[\p{P}\p{S}]/u.test(value),
    spacing: !/[\p{White_Space}\p{Cc}\p{Cs}\p{Cf}]/u.test(value) };
}
export function newPasswordValid(value: string): boolean { return Object.values(passwordChecks(value)).every(Boolean); }
