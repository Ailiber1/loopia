import { LanguageProvider } from './contexts/LanguageContext';
import { AppProvider } from './contexts/AppContext';
import UploadButton from './components/UploadButton';
import DurationSelect from './components/DurationSelect';
import StartButton from './components/StartButton';
import DownloadButton from './components/DownloadButton';
import DeleteIcon from './components/DeleteIcon';
import Preview from './components/Preview';
import ProgressBar from './components/ProgressBar';
import LanguageToggle from './components/LanguageToggle';
import ErrorDisplay from './components/ErrorDisplay';
import Guide from './components/Guide';
import './styles/global.css';
import './App.css';

function AppContent() {
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <h1 className="logo">LOOPIA</h1>
        <div className="header-actions">
          <Guide />
          <LanguageToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="main">
        {/* Left Panel - Controls */}
        <aside className="controls-panel">
          <div className="controls-content">
            <UploadButton />
            <DurationSelect />
            <StartButton />
            <DownloadButton />
          </div>
          <div className="controls-footer">
            <DeleteIcon />
          </div>
        </aside>

        {/* Right Panel - Preview */}
        <section className="preview-panel">
          <Preview />
          <ErrorDisplay />
        </section>
      </main>

      {/* Progress Bar */}
      <ProgressBar />
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </LanguageProvider>
  );
}

export default App;
