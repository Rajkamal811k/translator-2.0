import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Supported languages for translation.
 * Each entry maps a display name to a BCP 47 language code.
 */
export const LANGUAGES = [
  { code: 'en-US', name: 'English', translationCode: 'en' },
  { code: 'es-ES', name: 'Spanish', translationCode: 'es' },
  { code: 'fr-FR', name: 'French', translationCode: 'fr' },
  { code: 'de-DE', name: 'German', translationCode: 'de' },
  { code: 'it-IT', name: 'Italian', translationCode: 'it' },
  { code: 'pt-BR', name: 'Portuguese', translationCode: 'pt' },
  { code: 'ru-RU', name: 'Russian', translationCode: 'ru' },
  { code: 'ja-JP', name: 'Japanese', translationCode: 'ja' },
  { code: 'ko-KR', name: 'Korean', translationCode: 'ko' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', translationCode: 'zh-CN' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', translationCode: 'zh-TW' },
  { code: 'ar-SA', name: 'Arabic', translationCode: 'ar' },
  { code: 'hi-IN', name: 'Hindi', translationCode: 'hi' },
  { code: 'bn-IN', name: 'Bengali', translationCode: 'bn' },
  { code: 'ta-IN', name: 'Tamil', translationCode: 'ta' },
  { code: 'te-IN', name: 'Telugu', translationCode: 'te' },
  { code: 'tr-TR', name: 'Turkish', translationCode: 'tr' },
  { code: 'pl-PL', name: 'Polish', translationCode: 'pl' },
  { code: 'nl-NL', name: 'Dutch', translationCode: 'nl' },
  { code: 'sv-SE', name: 'Swedish', translationCode: 'sv' },
  { code: 'th-TH', name: 'Thai', translationCode: 'th' },
  { code: 'vi-VN', name: 'Vietnamese', translationCode: 'vi' },
  { code: 'uk-UA', name: 'Ukrainian', translationCode: 'uk' },
  { code: 'id-ID', name: 'Indonesian', translationCode: 'id' },
  { code: 'ms-MY', name: 'Malay', translationCode: 'ms' },
];

/**
 * Hook for speech recognition (voice input).
 * Uses the Web Speech API (SpeechRecognition).
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(
    (langCode = 'en-US') => {
      if (!isSupported) {
        setError('Speech recognition is not supported in this browser.');
        return;
      }

      // Stop any existing recognition session
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.lang = langCode;
      recognition.interimResults = true;
      recognition.continuous = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript('');
        setInterimTranscript('');
      };

      recognition.onresult = (event) => {
        let final = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        setTranscript(final);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        if (event.error !== 'aborted') {
          setError(`Recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isSupported]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    setTranscript,
  };
}

/**
 * Hook for text-to-speech (voice output).
 * Uses the Web Speech Synthesis API.
 * Properly waits for voices to load before speaking.
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [error, setError] = useState(null);
  const utteranceRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Load voices — they load asynchronously in most browsers
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    // Try loading immediately (works in Firefox)
    loadVoices();

    // Listen for async voice loading (needed for Chrome, Edge)
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [isSupported]);

  // Find the best matching voice for a language code
  const findVoice = useCallback(
    (langCode) => {
      if (voices.length === 0) return null;

      const langPrefix = langCode.split('-')[0].toLowerCase();

      // Strategy 1: Exact match (e.g., ta-IN === ta-IN)
      let voice = voices.find(
        (v) => v.lang.toLowerCase() === langCode.toLowerCase()
      );
      if (voice) return voice;

      // Strategy 2: Prefix match (e.g., ta-IN starts with ta)
      voice = voices.find(
        (v) => v.lang.toLowerCase().startsWith(langPrefix)
      );
      if (voice) return voice;

      // Strategy 3: Try Google / Microsoft voices (higher quality)
      voice = voices.find(
        (v) =>
          v.lang.toLowerCase().startsWith(langPrefix) &&
          (v.name.includes('Google') || v.name.includes('Microsoft'))
      );
      if (voice) return voice;

      return null;
    },
    [voices]
  );

  const speak = useCallback(
    (text, langCode = 'en-US') => {
      if (!isSupported || !text) return;

      setError(null);

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.92;
      utterance.pitch = 1;

      // Find and set the best matching voice
      const matchingVoice = findVoice(langCode);
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setError(null);
      };

      utterance.onend = () => setIsSpeaking(false);

      utterance.onerror = (e) => {
        setIsSpeaking(false);
        if (e.error !== 'canceled') {
          setError(
            `Voice playback failed for this language. Try using Chrome for best support.`
          );
        }
      };

      utteranceRef.current = utterance;

      // Chrome has a bug where speech can fail if called immediately
      // Adding a small delay fixes it
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 100);
    },
    [isSupported, findVoice]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Check if a voice is available for a given language
  const hasVoiceFor = useCallback(
    (langCode) => {
      return findVoice(langCode) !== null;
    },
    [findVoice]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { isSpeaking, speak, stop, isSupported, error, hasVoiceFor, voices };
}

/**
 * Translate text using MyMemory Translation API (free, no key needed).
 */
export async function translateText(text, sourceLang, targetLang) {
  if (!text.trim()) return '';

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=${sourceLang}|${targetLang}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.responseStatus === 200 && data.responseData?.translatedText) {
    return data.responseData.translatedText;
  }

  throw new Error(data.responseDetails || 'Translation failed');
}
