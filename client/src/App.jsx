import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CreateArt from './pages/CreateArt';

// Placeholder pages for now
const Dashboard = () => <div className="text-white text-2xl p-8">Dashboard (em breve)</div>;
const Clients = () => <div className="text-white text-2xl p-8">Clientes (em breve)</div>;
const Gallery = () => <div className="text-white text-2xl p-8">Galeria (em breve)</div>;

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="create" element={<CreateArt />} />
        <Route path="clients" element={<Clients />} />
        <Route path="gallery" element={<Gallery />} />
      </Route>
    </Routes>
  );
}
