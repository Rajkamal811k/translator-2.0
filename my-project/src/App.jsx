import { useState, useCallback, useRef, useEffect } from 'react';
import './App.css';
import {
  LANGUAGES,
  useSpeechRecognition,
  useSpeechSynthesis,
  translateText,
} from './hooks';

/* ===== Waveform Visualizer Component ===== */
function Waveform({ isActive }) {
  const [bars, setBars] = useState(Array(20).fill(4));
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setBars((prev) =>
          prev.map(() => Math.random() * 32 + 4)
        );
      }, 100);
    } else {
      clearInterval(intervalRef.current);
      setBars(Array(20).fill(4));
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive]);

  return (
    <div className="waveform" id="waveform-visualizer">
      {bars.map((h, i) => (
        <div
          key={i}
          className="waveform__bar"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

/* ===== Main App Component ===== */
function App() {
  // Language state
  const [sourceLang, setSourceLang] = useState(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState(LANGUAGES[1]); // Spanish

  // Text state
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready — tap the mic to start');
  const [statusType, setStatusType] = useState('ready'); // ready | busy | error

  // History
  const [history, setHistory] = useState([]);

  // Hooks
  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    isSupported: speechSupported,
    startListening,
    stopListening,
    setTranscript,
  } = useSpeechRecognition();

  const {
    isSpeaking,
    speak,
    stop: stopSpeaking,
    isSupported: synthSupported,
    error: synthError,
    hasVoiceFor,
    voices,
  } = useSpeechSynthesis();

  // Update input text when speech recognition produces results
  useEffect(() => {
    if (transcript || interimTranscript) {
      setInputText(transcript + interimTranscript);
    }
  }, [transcript, interimTranscript]);

  // Update status on speech error
  useEffect(() => {
    if (speechError) {
      setStatusMessage(speechError);
      setStatusType('error');
    }
  }, [speechError]);

  // Update status on TTS error
  useEffect(() => {
    if (synthError) {
      setStatusMessage(synthError);
      setStatusType('error');
    }
  }, [synthError]);

  // Toggle mic
  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      setStatusMessage('Processing your speech…');
      setStatusType('busy');
      // Small delay so the final transcript settles
      setTimeout(() => {
        setStatusMessage('Speech captured — press Translate');
        setStatusType('ready');
      }, 500);
    } else {
      setInputText('');
      setOutputText('');
      startListening(sourceLang.code);
      setStatusMessage('Listening… speak now');
      setStatusType('busy');
    }
  }, [isListening, startListening, stopListening, sourceLang]);

  // Translate
  const handleTranslate = useCallback(async () => {
    const text = inputText.trim();
    if (!text) {
      setStatusMessage('Please enter or speak some text first');
      setStatusType('error');
      return;
    }

    setIsTranslating(true);
    setStatusMessage('Translating…');
    setStatusType('busy');
    setOutputText('');

    try {
      const result = await translateText(
        text,
        sourceLang.translationCode,
        targetLang.translationCode
      );
      setOutputText(result);
      setStatusMessage('Translation complete!');
      setStatusType('ready');

      // Auto-speak the result
      if (synthSupported) {
        if (hasVoiceFor(targetLang.code)) {
          speak(result, targetLang.code);
          setStatusMessage('Playing translation…');
          setStatusType('busy');
        } else {
          // Still try to speak — the browser may use a default voice
          speak(result, targetLang.code);
          setStatusMessage(
            `Translation done! Voice for ${targetLang.name} may not be available on this device.`
          );
          setStatusType('ready');
        }
      }

      // Add to history
      setHistory((prev) => [
        {
          id: Date.now(),
          original: text,
          translated: result,
          from: sourceLang,
          to: targetLang,
          timestamp: new Date(),
        },
        ...prev.slice(0, 9), // Keep last 10
      ]);
    } catch (err) {
      setStatusMessage(`Translation failed: ${err.message}`);
      setStatusType('error');
    } finally {
      setIsTranslating(false);
    }
  }, [inputText, sourceLang, targetLang, synthSupported, speak]);

  // Swap languages
  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(outputText);
    setOutputText('');
  }, [sourceLang, targetLang, outputText]);

  // Copy text to clipboard
  const handleCopy = useCallback((text) => {
    navigator.clipboard.writeText(text);
    setStatusMessage('Copied to clipboard!');
    setStatusType('ready');
  }, []);

  // Play history item
  const handlePlayHistory = useCallback(
    (item) => {
      setOutputText(item.translated);
      setInputText(item.original);
      setSourceLang(item.from);
      setTargetLang(item.to);
      speak(item.translated, item.to.code);
    },
    [speak]
  );

  // Clear input
  const handleClear = useCallback(() => {
    setInputText('');
    setOutputText('');
    setTranscript('');
    setStatusMessage('Ready — tap the mic to start');
    setStatusType('ready');
  }, [setTranscript]);

  // Check browser support
  if (!speechSupported) {
    return (
      <div className="app">
        <header className="header">
          <div className="header__logo">
            <div className="header__icon">🌐</div>
            <div>
              <h1 className="header__title">VoiceBridge</h1>
              <p className="header__subtitle">Voice-to-Voice Translator</p>
            </div>
          </div>
        </header>
        <main className="main">
          <div className="not-supported" id="not-supported-banner">
            <div className="not-supported__icon">🎙️</div>
            <h2 className="not-supported__title">Browser Not Supported</h2>
            <p className="not-supported__text">
              Speech recognition requires a modern browser like Google Chrome,
              Microsoft Edge, or Safari. Please switch to one of these browsers
              to use VoiceBridge.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header" id="app-header">
        <div className="header__logo">
          <div className="header__icon">🌐</div>
          <div>
            <h1 className="header__title">VoiceBridge</h1>
            <p className="header__subtitle">Voice-to-Voice Translator</p>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Language Selector */}
        <div className="lang-selector" id="language-selector">
          <div className="lang-selector__dropdown">
            <label className="lang-selector__label" htmlFor="source-lang">
              From
            </label>
            <select
              id="source-lang"
              className="lang-selector__select"
              value={sourceLang.code}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.code === e.target.value);
                if (lang) setSourceLang(lang);
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="lang-selector__swap"
            onClick={handleSwapLanguages}
            title="Swap languages"
            id="swap-languages-btn"
          >
            ⇄
          </button>

          <div className="lang-selector__dropdown">
            <label className="lang-selector__label" htmlFor="target-lang">
              To
            </label>
            <select
              id="target-lang"
              className="lang-selector__select"
              value={targetLang.code}
              onChange={(e) => {
                const lang = LANGUAGES.find((l) => l.code === e.target.value);
                if (lang) setTargetLang(lang);
              }}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mic Button */}
        <div className="mic-section" id="mic-section">
          <button
            className={`mic-btn ${isListening ? 'mic-btn--recording' : ''}`}
            onClick={handleMicToggle}
            id="mic-toggle-btn"
            title={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isListening ? '⏹' : '🎙️'}
          </button>
          <span
            className={`mic-label ${isListening ? 'mic-label--recording' : ''}`}
          >
            {isListening
              ? 'Listening… tap to stop'
              : 'Tap to speak'}
          </span>
          <Waveform isActive={isListening} />
        </div>

        {/* Translation Panels */}
        <div className="panels" id="translation-panels">
          {/* Input Panel */}
          <div className="panel panel--input" id="input-panel">
            <div className="panel__header">
              <span className="panel__title">
                <span className="panel__title-icon">📝</span>
                {sourceLang.name}
              </span>
              <div className="panel__actions">
                <button
                  className="panel__action-btn"
                  onClick={handleClear}
                  title="Clear"
                  id="clear-input-btn"
                >
                  ✕
                </button>
                <button
                  className="panel__action-btn"
                  onClick={() => handleCopy(inputText)}
                  title="Copy"
                  id="copy-input-btn"
                >
                  📋
                </button>
              </div>
            </div>
            <div className="panel__body">
              <textarea
                className="panel__textarea"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Speak or type your text here…"
                id="input-textarea"
              />
              <div className="panel__char-count">
                {inputText.length} characters
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="panel panel--output" id="output-panel">
            <div className="panel__header">
              <span className="panel__title">
                <span className="panel__title-icon">🔊</span>
                {targetLang.name}
              </span>
              <div className="panel__actions">
                <button
                  className="panel__action-btn"
                  onClick={() => handleCopy(outputText)}
                  title="Copy"
                  id="copy-output-btn"
                >
                  📋
                </button>
                <button
                  className={`panel__action-btn ${isSpeaking ? 'panel__action-btn--active' : ''}`}
                  onClick={() => {
                    if (isSpeaking) {
                      stopSpeaking();
                    } else if (outputText) {
                      speak(outputText, targetLang.code);
                    }
                  }}
                  title={isSpeaking ? 'Stop speaking' : 'Play translation'}
                  id="play-output-btn"
                >
                  {isSpeaking ? '⏹' : '▶'}
                </button>
              </div>
            </div>
            <div className="panel__body">
              <div
                className={`panel__text ${!outputText ? 'panel__text--placeholder' : ''}`}
                id="output-text"
              >
                {outputText || 'Translation will appear here…'}
              </div>
            </div>
          </div>
        </div>

        {/* Translate Button */}
        <button
          className="translate-btn"
          onClick={handleTranslate}
          disabled={isTranslating || !inputText.trim()}
          id="translate-btn"
        >
          {isTranslating && <div className="spinner" />}
          {isTranslating ? 'Translating…' : '✨ Translate & Speak'}
        </button>

        {/* Status Bar */}
        <div className="status-bar" id="status-bar">
          <div
            className={`status-bar__dot ${
              statusType === 'error'
                ? 'status-bar__dot--error'
                : statusType === 'busy'
                  ? 'status-bar__dot--busy'
                  : ''
            }`}
          />
          <span>{statusMessage}</span>
        </div>

        {/* History */}
        {history.length > 0 && (
          <section className="history" id="translation-history">
            <h2 className="history__title">
              🕐 Recent Translations
            </h2>
            <div className="history__list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="history__item"
                  onClick={() => handlePlayHistory(item)}
                  id={`history-item-${item.id}`}
                >
                  <div className="history__item-icon">🌍</div>
                  <div className="history__item-content">
                    <div className="history__item-original">
                      {item.original}
                    </div>
                    <div className="history__item-translated">
                      {item.translated}
                    </div>
                    <div className="history__item-meta">
                      {item.from.name} → {item.to.name} •{' '}
                      {item.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    className="history__item-play"
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(item.translated, item.to.code);
                    }}
                    title="Replay"
                    id={`replay-btn-${item.id}`}
                  >
                    ▶
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
