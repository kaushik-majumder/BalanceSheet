export const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;
export type Gender = (typeof GENDERS)[number];

export type ProfileDraft = {
  firstName: string;
  lastName: string;
  gender: Gender | null;
  age: string; // raw text from input; validated to a number
  photoUri: string | null;
};

export type ProfileValidationError = {
  firstName?: string;
  lastName?: string;
  gender?: string;
  age?: string;
};

export const MIN_AGE = 13;
export const MAX_AGE = 120;
export const MAX_NAME_LEN = 40;

export function validateProfileDraft(draft: ProfileDraft): ProfileValidationError {
  const errors: ProfileValidationError = {};
  const firstName = draft.firstName.trim();
  const lastName = draft.lastName.trim();
  if (!firstName) errors.firstName = 'First name is required.';
  else if (firstName.length > MAX_NAME_LEN) errors.firstName = `Keep it under ${MAX_NAME_LEN} characters.`;

  if (!lastName) errors.lastName = 'Last name is required.';
  else if (lastName.length > MAX_NAME_LEN) errors.lastName = `Keep it under ${MAX_NAME_LEN} characters.`;

  if (!draft.gender) errors.gender = 'Pick one.';
  else if (!GENDERS.includes(draft.gender)) errors.gender = 'Pick one.';

  const trimmedAge = draft.age.trim();
  if (!trimmedAge) {
    errors.age = 'Age is required.';
  } else if (!/^\d+$/.test(trimmedAge)) {
    errors.age = 'Age must be a whole number.';
  } else {
    const n = parseInt(trimmedAge, 10);
    if (n < MIN_AGE) errors.age = `You must be at least ${MIN_AGE}.`;
    else if (n > MAX_AGE) errors.age = 'Please enter a realistic age.';
  }

  return errors;
}

export function isProfileValidationClean(errors: ProfileValidationError): boolean {
  return Object.keys(errors).length === 0;
}
