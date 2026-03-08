import { FormProvider } from "./store/FormContext";
import { PipecatProvider } from "./pipecat/PipecatProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { SimpleForm } from "./components/SimpleForm";
import { useExtensionBridge } from "./hooks/useExtensionBridge";

// Inner component that has access to FormContext for the extension bridge
function AppInner() {
  useExtensionBridge();

  return (
    <UltravoxProvider>
      <SimpleForm />
    </UltravoxProvider>
  );
}

function App() {
  return (
    <AccessibilityProvider>
      <FormProvider>
        <PipecatProvider>
          <SimpleForm />
        </PipecatProvider>
        <AppInner />
      </FormProvider>
    </AccessibilityProvider>
  );
}

export default App;
