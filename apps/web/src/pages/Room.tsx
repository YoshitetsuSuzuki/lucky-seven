import { useParams } from 'react-router-dom';
export default function Room() {
  const { code } = useParams();
  return <div className="p-6">ルーム {code}</div>;
}
