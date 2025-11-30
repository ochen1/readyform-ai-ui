import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";
import { AccessibilityProvider } from "./store/AccessibilityContext";
import { SimpleForm } from "./components/SimpleForm";

function App() {
  return (
    <AccessibilityProvider>
      <FormProvider>
        <UltravoxProvider>
          <SimpleForm />
        </UltravoxProvider>
      </FormProvider>
    </AccessibilityProvider>
  );
}

export default App;
