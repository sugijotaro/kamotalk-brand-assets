# KamoTalk Brand Assets

KamoTalkの公式ブランド素材を配布するためのリポジトリです。

## Assets

<img src="assets/logo/png/kamotalk-symbol-square.png" alt="KamoTalk logo" width="240">

## Download

最新版の素材は、[Releases](https://github.com/sugijotaro/kamotalk-brand-assets/releases)からダウンロードしてください。

ReleaseのZIPに含まれるSVGは、`<image>`で参照しているSVGをすべてインライン展開した配布用ファイルです。

## Development

SVGからPNGを書き出す場合は、以下を実行してください。

```sh
node scripts/build-assets.mjs export-pngs
```

Release用のZIPは以下で生成できます。

```sh
node scripts/build-assets.mjs release-package
```

## Usage

利用条件は [`LICENSE.md`](LICENSE.md) を確認してください。

## Contact

- Website: https://kamotalk.jp/
- Instagram: [@kamotalk.jp](https://www.instagram.com/kamotalk.jp/)
- note: [@kamotalk](https://note.com/kamotalk)
