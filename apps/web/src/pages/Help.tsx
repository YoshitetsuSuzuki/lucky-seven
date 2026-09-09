import HelpSheet from '../components/HelpSheet';
import { useGoBack } from '../hooks/useGoBack';

/** `#/help`。シートと同じ見た目・同じ中身を1枚のページとして出す */
export default function Help() {
  const back = useGoBack();
  return <HelpSheet onClose={back} />;
}
