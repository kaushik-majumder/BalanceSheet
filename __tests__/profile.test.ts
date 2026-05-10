import {
  GENDERS,
  MAX_AGE,
  MAX_NAME_LEN,
  MIN_AGE,
  ProfileDraft,
  isProfileValidationClean,
  validateProfileDraft,
} from '../lib/profileValidation';

const validDraft: ProfileDraft = {
  firstName: 'Jane',
  lastName: 'Doe',
  gender: 'Female',
  age: '28',
  photoUri: null,
};

describe('validateProfileDraft', () => {
  it('accepts a fully valid draft', () => {
    expect(validateProfileDraft(validDraft)).toEqual({});
    expect(isProfileValidationClean(validateProfileDraft(validDraft))).toBe(true);
  });

  it('trims whitespace before checking emptiness', () => {
    expect(validateProfileDraft({ ...validDraft, firstName: '  Jane  ' })).toEqual({});
  });

  describe('first name', () => {
    it('rejects empty', () => {
      expect(validateProfileDraft({ ...validDraft, firstName: '' }).firstName).toBeTruthy();
      expect(validateProfileDraft({ ...validDraft, firstName: '   ' }).firstName).toBeTruthy();
    });

    it('rejects names over the max length', () => {
      const long = 'a'.repeat(MAX_NAME_LEN + 1);
      expect(validateProfileDraft({ ...validDraft, firstName: long }).firstName).toBeTruthy();
    });
  });

  describe('last name', () => {
    it('rejects empty', () => {
      expect(validateProfileDraft({ ...validDraft, lastName: '' }).lastName).toBeTruthy();
    });

    it('accepts at the max length', () => {
      const ok = 'a'.repeat(MAX_NAME_LEN);
      expect(validateProfileDraft({ ...validDraft, lastName: ok }).lastName).toBeUndefined();
    });
  });

  describe('gender', () => {
    it('rejects null', () => {
      expect(validateProfileDraft({ ...validDraft, gender: null }).gender).toBeTruthy();
    });

    it('rejects values outside the enum (defensive — UI restricts to chips)', () => {
      const draft = { ...validDraft, gender: 'Banana' as unknown as ProfileDraft['gender'] };
      expect(validateProfileDraft(draft).gender).toBeTruthy();
    });

    it.each(GENDERS)('accepts %s', (g) => {
      expect(validateProfileDraft({ ...validDraft, gender: g }).gender).toBeUndefined();
    });
  });

  describe('age', () => {
    it('rejects empty', () => {
      expect(validateProfileDraft({ ...validDraft, age: '' }).age).toBeTruthy();
    });

    it('rejects non-numeric', () => {
      expect(validateProfileDraft({ ...validDraft, age: 'abc' }).age).toBeTruthy();
      expect(validateProfileDraft({ ...validDraft, age: '28.5' }).age).toBeTruthy();
      expect(validateProfileDraft({ ...validDraft, age: '-5' }).age).toBeTruthy();
    });

    it(`rejects ages below ${MIN_AGE} (Firebase TOS minimum)`, () => {
      expect(validateProfileDraft({ ...validDraft, age: '12' }).age).toBeTruthy();
      expect(validateProfileDraft({ ...validDraft, age: String(MIN_AGE - 1) }).age).toBeTruthy();
    });

    it(`accepts the minimum age (${MIN_AGE})`, () => {
      expect(validateProfileDraft({ ...validDraft, age: String(MIN_AGE) }).age).toBeUndefined();
    });

    it(`accepts the maximum age (${MAX_AGE})`, () => {
      expect(validateProfileDraft({ ...validDraft, age: String(MAX_AGE) }).age).toBeUndefined();
    });

    it(`rejects unrealistic ages (> ${MAX_AGE})`, () => {
      expect(validateProfileDraft({ ...validDraft, age: String(MAX_AGE + 1) }).age).toBeTruthy();
      expect(validateProfileDraft({ ...validDraft, age: '999' }).age).toBeTruthy();
    });
  });

  it('reports multiple errors at once (no early return)', () => {
    const draft: ProfileDraft = {
      firstName: '',
      lastName: '',
      gender: null,
      age: '',
      photoUri: null,
    };
    const errs = validateProfileDraft(draft);
    expect(errs.firstName).toBeTruthy();
    expect(errs.lastName).toBeTruthy();
    expect(errs.gender).toBeTruthy();
    expect(errs.age).toBeTruthy();
  });

  describe('photoUri', () => {
    it('is optional — null passes', () => {
      expect(validateProfileDraft({ ...validDraft, photoUri: null })).toEqual({});
    });

    it('is optional — a path is also fine', () => {
      expect(
        validateProfileDraft({ ...validDraft, photoUri: 'file:///some/path.jpg' }),
      ).toEqual({});
    });
  });
});

describe('isProfileValidationClean', () => {
  it('returns true on empty error object', () => {
    expect(isProfileValidationClean({})).toBe(true);
  });

  it('returns false when any field has an error', () => {
    expect(isProfileValidationClean({ firstName: 'oops' })).toBe(false);
  });
});
