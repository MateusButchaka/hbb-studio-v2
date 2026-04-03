import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateArt from './pages/CreateArt';
import Clientes from './pages/Clientes';
import Galeria from './pages/Galeria';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateArt />} />
        <Route path="clients" element={<Clientes />} />
        <Route path="gallery" element={<Galeria />} />
      </Route>
    </Routes>
  );
}
