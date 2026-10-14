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
 */
export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text, langCode = 'en-US') => {
      if (!isSupported || !text) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = langCode;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      // Try to find a voice that matches the language
      const voices = window.speechSynthesis.getVoices();
      const langPrefix = langCode.split('-')[0];
      const matchingVoice = voices.find((v) => v.lang.startsWith(langPrefix));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const stop = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return { isSpeaking, speak, stop, isSupported };
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
