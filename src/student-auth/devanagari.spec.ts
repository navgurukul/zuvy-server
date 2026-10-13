import { transliterateDevanagari as t } from './devanagari';

describe('transliterateDevanagari', () => {
  it('spells common names the way they are usually written in English', () => {
    const names: Array<[string, string]> = [
      ['रवि', 'ravi'],
      ['राम', 'ram'],
      ['सीता', 'sita'],
      ['प्रिया', 'priya'],
      ['अरुणेश', 'arunesh'],
      ['धर', 'dhar'],
      ['शर्मा', 'sharma'],
      ['राहुल', 'rahul'],
      ['कुमार', 'kumar'],
      ['मोहित', 'mohit'],
      ['आरव', 'arav'],
      ['लक्ष्मी', 'lakshmi'],
      ['ज्ञान', 'gyan'],
    ];
    for (const [hindi, english] of names) expect(t(hindi)).toBe(english);
  });

  it('keeps the final "a" after a consonant cluster and in one-letter words', () => {
    expect(t('कृष्ण')).toBe('krishna');
    expect(t('चन्द्र')).toBe('chandra');
    expect(t('न')).toBe('na');
  });

  it('handles nasal marks, visarga and a final virama', () => {
    expect(t('संजय')).toBe('sanjay');
    expect(t('अंकित')).toBe('ankit');
    expect(t('चाँद')).toBe('chand');
    expect(t('जगत्')).toBe('jagat');
  });

  it('handles dotted letters typed as one or two characters', () => {
    expect(t('\u095Bैनब')).toBe('zainab'); // precomposed ज़
    expect(t('ज\u093Cैनब')).toBe('zainab'); // ज + nukta
    expect(t('\u095Eातिमा')).toBe('fatima'); // precomposed फ़
  });

  it('ignores zero-width joiners and Devanagari digits', () => {
    expect(t('क्\u200Dष')).toBe('ksha');
    expect(t('क्ष')).toBe('ksha');
    expect(t('रवि१२')).toBe('ravi');
  });

  it('keeps spaces and other scripts, and leaves English names unchanged', () => {
    expect(t('अरुणेश धर')).toBe('arunesh dhar');
    expect(t('Ravi शर्मा')).toBe('Ravi sharma');
    expect(t('Arunesh Dhar')).toBe('Arunesh Dhar');
  });
});
