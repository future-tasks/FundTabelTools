import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import path from "node:path";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // 图标配置：electron-packager 会根据平台自动选择
    // macOS 使用 .icns，Windows 使用 .ico，Linux 使用 .png
    // 这里指定 macOS 图标，Windows 图标在 MakerSquirrel 中指定
    icon: path.resolve(__dirname, "public/icons/icon.icns"), // macOS 主图标
    extraResource: [
      // 确保所有图标文件都被包含在打包中
      path.resolve(__dirname, "public/icons/icon.icns"),
      path.resolve(__dirname, "public/icons/icon.ico"),
      path.resolve(__dirname, "public/icons/icon.png"),
    ],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // 关键配置！Squirrel 才认这个
      setupIcon: path.resolve(__dirname, "public/icons/icon.ico"), // 必须
      iconUrl: path.resolve(__dirname, "public/icons/icon.ico"), // 建议
    }),
    new MakerZIP({}, ["darwin"]),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "src/main.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
