import { FormProvider } from "./store/FormContext";
import { PipecatProvider } from "./pipecat/PipecatProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { SimpleForm } from "./components/SimpleForm";

function App() {
  return (
    <AccessibilityProvider>
      <FormProvider>
        <PipecatProvider>
          <SimpleForm />
        </PipecatProvider>
      </FormProvider>
    </AccessibilityProvider>
  );
}

export default App;
