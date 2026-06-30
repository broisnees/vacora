// Monochrome brand glyphs (simple-icons) keyed by platform id. Rendered with
// `fill: currentColor` so they stay grayscale and inherit the row's colour.
// Platforms without a brand mark (domains, email) fall back to a lucide
// category icon in ResultChip.
import {
  siNpm, siJsr, siPypi, siRust, siDocker, siRubygems, siNuget, siApachemaven,
  siHomebrew, siPackagist, siDart, siElixir, siCocoapods, siAnaconda, siR,
  siDeno, siWordpress, siFirefoxbrowser, siArchlinux, siChocolatey,
  siGithub, siGitlab, siCodeberg, siHuggingface,
  siX, siYoutube, siTelegram, siBluesky, siMastodon, siDevdotto, siLinktree,
  siKeybase, siGravatar, siYcombinator, siAboutdotme,
  siSubstack, siSoundcloud, siPatreon, siVimeo, siBehance, siDribbble, siItchdotio,
} from 'simple-icons'

export const BRAND_ICON: Record<string, string> = {
  // registries
  npm: siNpm.path,
  'npm-org': siNpm.path,
  jsr: siJsr.path,
  pypi: siPypi.path,
  crates: siRust.path,
  dockerhub: siDocker.path,
  rubygems: siRubygems.path,
  nuget: siNuget.path,
  maven: siApachemaven.path,
  homebrew: siHomebrew.path,
  'homebrew-cask': siHomebrew.path,
  packagist: siPackagist.path,
  'pub-dev': siDart.path,
  hex: siElixir.path,
  cocoapods: siCocoapods.path,
  anaconda: siAnaconda.path,
  cran: siR.path,
  deno: siDeno.path,
  'wp-plugin': siWordpress.path,
  firefox: siFirefoxbrowser.path,
  aur: siArchlinux.path,
  chocolatey: siChocolatey.path,
  // code & dev
  github: siGithub.path,
  gitlab: siGitlab.path,
  codeberg: siCodeberg.path,
  huggingface: siHuggingface.path,
  // social
  x: siX.path,
  youtube: siYoutube.path,
  telegram: siTelegram.path,
  bluesky: siBluesky.path,
  mastodon: siMastodon.path,
  devto: siDevdotto.path,
  linktree: siLinktree.path,
  keybase: siKeybase.path,
  gravatar: siGravatar.path,
  hackernews: siYcombinator.path,
  aboutme: siAboutdotme.path,
  // creator & content
  substack: siSubstack.path,
  soundcloud: siSoundcloud.path,
  patreon: siPatreon.path,
  vimeo: siVimeo.path,
  behance: siBehance.path,
  dribbble: siDribbble.path,
  itch: siItchdotio.path,
}
