// 네이티브(C++) 빌드에 쓸 CMake 버전을 고정하는 설정 플러그인.
//
// 왜: 윈도우에서 안드로이드 SDK 기본 CMake(3.22.1)에 들어 있는 ninja 1.10은
// 260자를 넘는 경로를 못 다뤄 "Filename longer than 260 characters"로 빌드가 실패한다.
// CMake 3.31.6에 들어 있는 ninja 1.12는 긴 경로를 다룬다. (Admin_Docs/troubleshooting/T-002)
//
// android/ 폴더는 prebuild가 만들어 내는 산출물이라 직접 고치지 않고 여기서 덧붙인다.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// pacerun: cmake version';

module.exports = function withCmakeVersion(config, { version }) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error('withCmakeVersion: app/build.gradle이 Groovy가 아니라서 CMake 버전을 넣을 수 없어요');
    }
    if (!mod.modResults.contents.includes(MARKER)) {
      mod.modResults.contents += `
${MARKER}
android {
    externalNativeBuild {
        cmake {
            version "${version}"
        }
    }
}
`;
    }
    return mod;
  });
};
