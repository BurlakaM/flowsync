import { RouterProvider } from 'react-router/dom';
import { AppProvider } from './provider';
import { createAppRouter } from './router';

const router = createAppRouter();

export function App() {
  return (
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  );
}
