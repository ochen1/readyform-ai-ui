import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";
import { SimpleForm } from "./components/SimpleForm";

function App() {
  return (
    <FormProvider>
      <UltravoxProvider>
        <SimpleForm />
      </UltravoxProvider>
    </FormProvider>
  );
}

export default App;
