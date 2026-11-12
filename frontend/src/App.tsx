import { useTheme } from "./hooks/useTheme";
import { useCourseStore } from "./store/courseStore";
import AppHeader from "./components/AppHeader";
import ChangeVisualizationPanel from "./components/ChangeVisualizationPanel";

function App() {
  useTheme();

  const changesRawText = useCourseStore((s) => s.changesRawText);
  const setChangesRawText = useCourseStore((s) => s.setChangesRawText);
  const changesParsedData = useCourseStore((s) => s.changesParsedData);
  const setChangesParsedData = useCourseStore((s) => s.setChangesParsedData);

  return (
    <div className="flex flex-col h-screen bg-th-bg">
      <AppHeader />
      <main className="flex-1 min-h-0 overflow-hidden">
        <ChangeVisualizationPanel
          rawText={changesRawText}
          onRawTextChange={setChangesRawText}
          parsedData={changesParsedData}
          onParsedDataChange={setChangesParsedData}
        />
      </main>
    </div>
  );
}

export default App;
