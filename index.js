// 導入 Expo 的根組件註冊工具
import { registerRootComponent } from 'expo';

// 導入主應用程式組件
import App from './App';

// registerRootComponent 會呼叫 AppRegistry.registerComponent('main', () => App);
// 這能確保無論是在 Expo Go 還是原生構建中加載 App，
// 環境都能得到適當的設置。
registerRootComponent(App);
