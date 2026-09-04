import { describe, expect, it } from 'vitest';
import { fallbackTriage } from '@/lib/triage/fallback';

/**
 * Validates: Requirements 9.3, 21.1, 22.5
 */
describe('fallbackTriage', () => {
  describe('one example per risk level, per script', () => {
    it('classifies English high-risk keywords as high', () => {
      const result = fallbackTriage('She has chest pain and is breathless.', 'en-IN');
      expect(result.risk_level).toBe('high');
      expect(result.matched).toContain('chest pain');
      expect(result.source).toBe('fallback');
    });

    it('classifies Devanagari high-risk keywords as high', () => {
      const result = fallbackTriage('सीने में दर्द है और साँस फूल रही है।', 'hi-IN');
      expect(result.risk_level).toBe('high');
      expect(result.matched).toContain('सीने में दर्द');
    });

    it('classifies Latin-script Hindi high-risk keywords as high', () => {
      /* A romanised mis-transcription still has to triage correctly. */
      const result = fallbackTriage('seene mein dard aur saans phool rahi hai', 'hi-IN');
      expect(result.risk_level).toBe('high');
      expect(result.matched).toContain('seene mein dard');
    });

    it('classifies English medium-risk keywords as medium', () => {
      const result = fallbackTriage('Fever for four days with weakness.', 'en-IN');
      expect(result.risk_level).toBe('medium');
      expect(result.matched).toContain('fever');
    });

    it('classifies Devanagari medium-risk keywords as medium', () => {
      const result = fallbackTriage('चार दिन से बुखार और कमजोरी।', 'hi-IN');
      expect(result.risk_level).toBe('medium');
      expect(result.matched).toContain('बुखार');
    });

    it('classifies Latin-script Hindi medium-risk keywords as medium', () => {
      const result = fallbackTriage('char din se bukhar aur kamzori', 'hi-IN');
      expect(result.risk_level).toBe('medium');
      expect(result.matched).toContain('bukhar');
    });

    it('classifies English low-risk keywords as low', () => {
      const result = fallbackTriage('Runny nose and itching for two days.', 'en-IN');
      expect(result.risk_level).toBe('low');
      expect(result.matched).toContain('runny nose');
    });

    it('classifies Devanagari low-risk keywords as low', () => {
      const result = fallbackTriage('जुकाम और खुजली है।', 'hi-IN');
      expect(result.risk_level).toBe('low');
      expect(result.matched).toContain('जुकाम');
    });

    it('classifies Latin-script Hindi low-risk keywords as low', () => {
      const result = fallbackTriage('jukam aur khujli hai', 'hi-IN');
      expect(result.risk_level).toBe('low');
      expect(result.matched).toContain('jukam');
    });
  });

  describe('the no-match default', () => {
    /* Under-triage is the asymmetric error: an unclassifiable complaint carries
       no information, and the safe reading of no information is "a clinician
       should look at this." */
    it('returns medium, never low, when nothing matches', () => {
      const result = fallbackTriage('मुझे कुछ ठीक नहीं लग रहा', 'hi-IN');
      expect(result.risk_level).toBe('medium');
      expect(result.matched).toEqual([]);
    });

    it('returns medium for an empty transcript', () => {
      const result = fallbackTriage('', 'en-IN');
      expect(result.risk_level).toBe('medium');
      expect(result.matched).toEqual([]);
    });

    it('returns a non-empty summary and next step on every path', () => {
      for (const transcript of ['', 'chest pain', 'fever', 'jukam', 'xyzzy']) {
        const result = fallbackTriage(transcript, 'en-IN');
        expect(result.summary.length).toBeGreaterThan(0);
        expect(result.recommended_next_step.length).toBeGreaterThan(0);
      }
    });
  });

  describe('precedence', () => {
    it('high wins a transcript mixing all three tiers', () => {
      const result = fallbackTriage(
        'jukam se shuru hua, phir bukhar aaya, ab seene mein dard hai',
        'hi-IN',
      );
      expect(result.risk_level).toBe('high');
    });

    it('medium wins over low', () => {
      const result = fallbackTriage('Cold and itching, now fever too.', 'en-IN');
      expect(result.risk_level).toBe('medium');
    });
  });

  describe('the pregnancy composite rule', () => {
    it('escalates a pregnancy term plus bleeding to high', () => {
      const result = fallbackTriage('गर्भवती है और खून बह रहा है', 'hi-IN');
      expect(result.risk_level).toBe('high');
    });

    it('escalates a pregnancy term plus pain to high in Latin script', () => {
      /* Neither `pregnan` nor `pain` is a high keyword on its own — the
         composite rule is what fires here. */
      const result = fallbackTriage('pregnant with pain', 'en-IN');
      expect(result.risk_level).toBe('high');
      expect(result.matched).toContain('pregnan');
    });

    it('does not escalate a pregnancy term alone', () => {
      const result = fallbackTriage('garbh ki jaanch karani hai', 'hi-IN');
      expect(result.risk_level).not.toBe('high');
    });
  });

  describe('normalisation', () => {
    it('is insensitive to case, punctuation and the danda', () => {
      const a = fallbackTriage('CHEST PAIN!!!', 'en-IN');
      const b = fallbackTriage('chest pain', 'en-IN');
      expect(a.risk_level).toBe(b.risk_level);

      const c = fallbackTriage('बुखार।', 'hi-IN');
      expect(c.risk_level).toBe('medium');
    });
  });
});
