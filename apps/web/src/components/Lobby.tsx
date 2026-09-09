import type { PlayerRow, RoomRow } from '../hooks/useRoom';
export interface ScreenProps { room: RoomRow; players: PlayerRow[]; me: PlayerRow; isHost: boolean }
export default function Lobby({ room }: ScreenProps) {
  return <div className="p-6">Lobby {room.code}</div>;
}
