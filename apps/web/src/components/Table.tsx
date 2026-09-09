import type { PlayerRow, RoomRow } from '../hooks/useRoom';
export interface ScreenProps { room: RoomRow; players: PlayerRow[]; me: PlayerRow; isHost: boolean }
export default function Table({ room }: ScreenProps) {
  return <div className="p-6">Table {room.code}</div>;
}
