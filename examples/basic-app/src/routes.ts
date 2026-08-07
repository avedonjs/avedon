import { defineRoutes, route, requireSession } from '@avedon/server'
import Layout from './pages/Layout.ave'
import Home from './pages/Home.ave'
import Post from './pages/Post.ave'
import Admin from './pages/Admin.ave'
import AdminError from './pages/AdminError.ave'
import Doc from './pages/Doc.ave'
import Stream from './pages/Stream.ave'
import ErrorLabNf from './pages/ErrorLabNf.ave'
import ErrorLabBoom from './pages/ErrorLabBoom.ave'
import ErrorLabPlainNf from './pages/ErrorLabPlainNf.ave'
import ErrorLabNestedBoom from './pages/ErrorLabNestedBoom.ave'
import ErrorLabParent from './pages/ErrorLabParent.ave'
import IsrLab from './pages/IsrLab.ave'
import StreamTtfbLab from './pages/StreamTtfbLab.ave'
import StreamRedirectLab from './pages/StreamRedirectLab.ave'
import StreamErrorLab from './pages/StreamErrorLab.ave'
import Login from './pages/Login.ave'
import KeyedEachLab from './pages/KeyedEachLab.ave'
import NamedSlotsLab from './pages/NamedSlotsLab.ave'
import ClaimIdentityLab from './pages/ClaimIdentityLab.ave'
import CrossfadeLab from './pages/CrossfadeLab.ave'
import NestedLoadShell from './pages/NestedLoadShell.ave'
import NestedLoadLab from './pages/NestedLoadLab.ave'
import ComponentBindLab from './pages/ComponentBindLab.ave'
import ClassDirectiveLab from './pages/ClassDirectiveLab.ave'
import StyleDirectiveLab from './pages/StyleDirectiveLab.ave'
import StyleCssVarLab from './pages/StyleCssVarLab.ave'
import BindCheckedLab from './pages/BindCheckedLab.ave'
import EventDispatcherLab from './pages/EventDispatcherLab.ave'
import UseActionLab from './pages/UseActionLab.ave'
import PortalLab from './pages/PortalLab.ave'
import ClickOutsideLab from './pages/ClickOutsideLab.ave'
import LongPressLab from './pages/LongPressLab.ave'
import HoldRepeatLab from './pages/HoldRepeatLab.ave'
import AutofocusLab from './pages/AutofocusLab.ave'
import SelectOnFocusLab from './pages/SelectOnFocusLab.ave'
import TrimLab from './pages/TrimLab.ave'
import TrimStartLab from './pages/TrimStartLab.ave'
import TrimEndLab from './pages/TrimEndLab.ave'
import NumericLab from './pages/NumericLab.ave'
import DecimalLab from './pages/DecimalLab.ave'
import HexLab from './pages/HexLab.ave'
import IntegerLab from './pages/IntegerLab.ave'
import SignedDecimalLab from './pages/SignedDecimalLab.ave'
import PhoneLab from './pages/PhoneLab.ave'
import EmailLab from './pages/EmailLab.ave'
import UrlLab from './pages/UrlLab.ave'
import UsernameLab from './pages/UsernameLab.ave'
import CreditCardLab from './pages/CreditCardLab.ave'
import PostalCodeLab from './pages/PostalCodeLab.ave'
import IbanLab from './pages/IbanLab.ave'
import CvvLab from './pages/CvvLab.ave'
import OtpLab from './pages/OtpLab.ave'
import CollapseWhitespaceLab from './pages/CollapseWhitespaceLab.ave'
import RemoveWhitespaceLab from './pages/RemoveWhitespaceLab.ave'
import RemoveDiacriticsLab from './pages/RemoveDiacriticsLab.ave'
import InitialsLab from './pages/InitialsLab.ave'
import SentenceCaseLab from './pages/SentenceCaseLab.ave'
import CamelCaseLab from './pages/CamelCaseLab.ave'
import SnakeCaseLab from './pages/SnakeCaseLab.ave'
import KebabCaseLab from './pages/KebabCaseLab.ave'
import ConstantCaseLab from './pages/ConstantCaseLab.ave'
import PascalCaseLab from './pages/PascalCaseLab.ave'
import DotCaseLab from './pages/DotCaseLab.ave'
import PathCaseLab from './pages/PathCaseLab.ave'
import TrainCaseLab from './pages/TrainCaseLab.ave'
import SwapCaseLab from './pages/SwapCaseLab.ave'
import ReverseLab from './pages/ReverseLab.ave'
import ExpiryLab from './pages/ExpiryLab.ave'
import LettersLab from './pages/LettersLab.ave'
import PinLab from './pages/PinLab.ave'
import AsciiLab from './pages/AsciiLab.ave'
import RemovePunctLab from './pages/RemovePunctLab.ave'
import CurrencyLab from './pages/CurrencyLab.ave'
import PercentLab from './pages/PercentLab.ave'
import AlphanumericLab from './pages/AlphanumericLab.ave'
import SlugifyLab from './pages/SlugifyLab.ave'
import CapitalizeLab from './pages/CapitalizeLab.ave'
import MaxLengthLab from './pages/MaxLengthLab.ave'
import LowercaseLab from './pages/LowercaseLab.ave'
import UppercaseLab from './pages/UppercaseLab.ave'
import AutoHeightLab from './pages/AutoHeightLab.ave'
import DebounceLab from './pages/DebounceLab.ave'
import ThrottleLab from './pages/ThrottleLab.ave'
import ChangeLab from './pages/ChangeLab.ave'
import InputLab from './pages/InputLab.ave'
import SubmitLab from './pages/SubmitLab.ave'
import FormDataLab from './pages/FormDataLab.ave'
import ResetLab from './pages/ResetLab.ave'
import InvalidLab from './pages/InvalidLab.ave'
import CopyLab from './pages/CopyLab.ave'
import PasteLab from './pages/PasteLab.ave'
import CutLab from './pages/CutLab.ave'
import BeforeinputLab from './pages/BeforeinputLab.ave'
import CompositionLab from './pages/CompositionLab.ave'
import SelectionchangeLab from './pages/SelectionchangeLab.ave'
import HoverLab from './pages/HoverLab.ave'
import DblclickLab from './pages/DblclickLab.ave'
import ContextmenuLab from './pages/ContextmenuLab.ave'
import WheelLab from './pages/WheelLab.ave'
import ScrollLab from './pages/ScrollLab.ave'
import SnapLab from './pages/SnapLab.ave'
import PressedLab from './pages/PressedLab.ave'
import FocusWithinLab from './pages/FocusWithinLab.ave'
import FocusLab from './pages/FocusLab.ave'
import FocusVisibleLab from './pages/FocusVisibleLab.ave'
import DownloadLab from './pages/DownloadLab.ave'
import FullscreenLab from './pages/FullscreenLab.ave'
import ResizeLab from './pages/ResizeLab.ave'
import SwipeLab from './pages/SwipeLab.ave'
import PinchLab from './pages/PinchLab.ave'
import TooltipLab from './pages/TooltipLab.ave'
import MutateLab from './pages/MutateLab.ave'
import StickyLab from './pages/StickyLab.ave'
import DragLab from './pages/DragLab.ave'
import DropzoneLab from './pages/DropzoneLab.ave'
import FocusTrapLab from './pages/FocusTrapLab.ave'
import LockScrollLab from './pages/LockScrollLab.ave'
import EscapeKeyLab from './pages/EscapeKeyLab.ave'
import InViewLab from './pages/InViewLab.ave'
import ScrollIntoViewLab from './pages/ScrollIntoViewLab.ave'
import InfiniteScrollLab from './pages/InfiniteScrollLab.ave'
import RevealLab from './pages/RevealLab.ave'
import LazyLab from './pages/LazyLab.ave'
import ScrollspyLab from './pages/ScrollspyLab.ave'
import HotkeyLab from './pages/HotkeyLab.ave'
import KeydownLab from './pages/KeydownLab.ave'
import KeyupLab from './pages/KeyupLab.ave'
import BindThisLab from './pages/BindThisLab.ave'
import BindGroupLab from './pages/BindGroupLab.ave'
import TransitionFadeLab from './pages/TransitionFadeLab.ave'
import TransitionDelayLab from './pages/TransitionDelayLab.ave'
import TransitionEasingLab from './pages/TransitionEasingLab.ave'
import TickLab from './pages/TickLab.ave'
import UntrackLab from './pages/UntrackLab.ave'
import ContextLab from './pages/ContextLab.ave'
import AllContextsLab from './pages/AllContextsLab.ave'
import UpdateHooksLab from './pages/UpdateHooksLab.ave'
import MediaQueryLab from './pages/MediaQueryLab.ave'
import PrefersReducedMotionLab from './pages/PrefersReducedMotionLab.ave'
import PrefersColorSchemeLab from './pages/PrefersColorSchemeLab.ave'
import PrefersContrastLab from './pages/PrefersContrastLab.ave'
import PrefersReducedTransparencyLab from './pages/PrefersReducedTransparencyLab.ave'
import PrefersReducedDataLab from './pages/PrefersReducedDataLab.ave'
import SaveDataSignalLab from './pages/SaveDataSignalLab.ave'
import ConnectionEffectiveTypeLab from './pages/ConnectionEffectiveTypeLab.ave'
import ConnectionDownlinkLab from './pages/ConnectionDownlinkLab.ave'
import ConnectionRttLab from './pages/ConnectionRttLab.ave'
import ForcedColorsLab from './pages/ForcedColorsLab.ave'
import InvertedColorsLab from './pages/InvertedColorsLab.ave'
import WindowSizeLab from './pages/WindowSizeLab.ave'
import PageScrollLab from './pages/PageScrollLab.ave'
import DevicePixelRatioLab from './pages/DevicePixelRatioLab.ave'
import PersistedSignalLab from './pages/PersistedSignalLab.ave'
import OnlineSignalLab from './pages/OnlineSignalLab.ave'
import NowSignalLab from './pages/NowSignalLab.ave'
import IdleSignalLab from './pages/IdleSignalLab.ave'
import LocaleSignalLab from './pages/LocaleSignalLab.ave'
import LocalesSignalLab from './pages/LocalesSignalLab.ave'
import TimeZoneSignalLab from './pages/TimeZoneSignalLab.ave'
import HardwareConcurrencyLab from './pages/HardwareConcurrencyLab.ave'
import DeviceMemoryLab from './pages/DeviceMemoryLab.ave'
import UserAgentLab from './pages/UserAgentLab.ave'
import DoNotTrackLab from './pages/DoNotTrackLab.ave'
import VendorLab from './pages/VendorLab.ave'
import AppVersionLab from './pages/AppVersionLab.ave'
import ProductLab from './pages/ProductLab.ave'
import AppNameLab from './pages/AppNameLab.ave'
import PlatformLab from './pages/PlatformLab.ave'
import AppCodeNameLab from './pages/AppCodeNameLab.ave'
import MaxTouchPointsLab from './pages/MaxTouchPointsLab.ave'
import CookieEnabledLab from './pages/CookieEnabledLab.ave'
import PdfViewerEnabledLab from './pages/PdfViewerEnabledLab.ave'
import WebdriverLab from './pages/WebdriverLab.ave'
import StorageEstimateLab from './pages/StorageEstimateLab.ave'
import StoragePersistedLab from './pages/StoragePersistedLab.ave'
import HashSignalLab from './pages/HashSignalLab.ave'
import SearchParamsSignalLab from './pages/SearchParamsSignalLab.ave'
import PathnameSignalLab from './pages/PathnameSignalLab.ave'
import DocumentTitleSignalLab from './pages/DocumentTitleSignalLab.ave'
import HtmlLangSignalLab from './pages/HtmlLangSignalLab.ave'
import HtmlDirSignalLab from './pages/HtmlDirSignalLab.ave'
import VisibilitySignalLab from './pages/VisibilitySignalLab.ave'
import ActiveElementLab from './pages/ActiveElementLab.ave'
import SoftHydrateFocusLab from './pages/SoftHydrateFocusLab.ave'
import SoftHydrateFormLab from './pages/SoftHydrateFormLab.ave'
import SoftHydrateScrollLab from './pages/SoftHydrateScrollLab.ave'
import BatchLab from './pages/BatchLab.ave'
import ReadonlyLab from './pages/ReadonlyLab.ave'
import TweenedLab from './pages/TweenedLab.ave'
import SpringLab from './pages/SpringLab.ave'
import SoftHydrateOpenLab from './pages/SoftHydrateOpenLab.ave'
import LifecycleLab from './pages/LifecycleLab.ave'
import PageTitleLab from './pages/PageTitleLab.ave'
import ComponentDestroyLab from './pages/ComponentDestroyLab.ave'
import SignalEffectLab from './pages/SignalEffectLab.ave'
import ElseIfLab from './pages/ElseIfLab.ave'
import EachElseLab from './pages/EachElseLab.ave'
import ConstLab from './pages/ConstLab.ave'
import AwaitPendingLab from './pages/AwaitPendingLab.ave'
import EventModifiersLab from './pages/EventModifiersLab.ave'
import CommentLab from './pages/CommentLab.ave'
import AwaitThenLab from './pages/AwaitThenLab.ave'
import BooleanAttrLab from './pages/BooleanAttrLab.ave'
import SelectBindLab from './pages/SelectBindLab.ave'
import NumberBindLab from './pages/NumberBindLab.ave'
import MultiSelectBindLab from './pages/MultiSelectBindLab.ave'
import FadeOutroLab from './pages/FadeOutroLab.ave'
import ReducedMotionTransitionLab from './pages/ReducedMotionTransitionLab.ave'
import KeyedOutroLab from './pages/KeyedOutroLab.ave'
import FlyLab from './pages/FlyLab.ave'
import InOutLab from './pages/InOutLab.ave'
import SlideLab from './pages/SlideLab.ave'
import SlideXLab from './pages/SlideXLab.ave'
import ScaleLab from './pages/ScaleLab.ave'
import SpinLab from './pages/SpinLab.ave'
import PopLab from './pages/PopLab.ave'
import BounceLab from './pages/BounceLab.ave'
import DropLab from './pages/DropLab.ave'
import ShakeLab from './pages/ShakeLab.ave'
import FlipLab from './pages/FlipLab.ave'
import PulseLab from './pages/PulseLab.ave'
import WipeLab from './pages/WipeLab.ave'
import SkewLab from './pages/SkewLab.ave'
import RollLab from './pages/RollLab.ave'
import ZoomLab from './pages/ZoomLab.ave'
import BlurLab from './pages/BlurLab.ave'
import SpreadLab from './pages/SpreadLab.ave'
import CompSpreadLab from './pages/CompSpreadLab.ave'
import FilesBindLab from './pages/FilesBindLab.ave'
import DimensionBindLab from './pages/DimensionBindLab.ave'
import ScrollBindLab from './pages/ScrollBindLab.ave'
import SelectionBindLab from './pages/SelectionBindLab.ave'
import IndeterminateBindLab from './pages/IndeterminateBindLab.ave'
import OpenBindLab from './pages/OpenBindLab.ave'
import MediaBindLab from './pages/MediaBindLab.ave'
import MediaEndedLab from './pages/MediaEndedLab.ave'
import MediaPlayedLab from './pages/MediaPlayedLab.ave'
import MediaSeekableLab from './pages/MediaSeekableLab.ave'
import MediaReadyStateLab from './pages/MediaReadyStateLab.ave'
import MediaNetworkStateLab from './pages/MediaNetworkStateLab.ave'
import MediaVideoSizeLab from './pages/MediaVideoSizeLab.ave'
import ImageNaturalSizeLab from './pages/ImageNaturalSizeLab.ave'
import TextContentBindLab from './pages/TextContentBindLab.ave'
import InnerTextBindLab from './pages/InnerTextBindLab.ave'
import DrawLab from './pages/DrawLab.ave'
import RouteNotFound from './pages/errors/RouteNotFound.ave'
import RouteError from './pages/errors/RouteError.ave'

const routes = defineRoutes([
  {
    path: '/',
    layout: Layout,
    component: Home,
    render: 'ssg',
  },
  {
    path: '/docs/:slug',
    layout: Layout,
    component: Doc,
    render: 'ssg',
    revalidate: 60,
    getStaticPaths: () => ['/docs/intro', '/docs/api'],
  },
  route('/posts/:id', {
    layout: Layout,
    component: Post,
    render: 'ssr',
    awaitHead: true,
  }),
  {
    path: '/stream',
    layout: Layout,
    component: Stream,
    render: 'ssr',
  },
  {
    path: '/stream-ttfb/stream',
    layout: Layout,
    component: StreamTtfbLab,
    render: 'ssr',
  },
  {
    path: '/stream-redirect/:mode',
    layout: Layout,
    component: StreamRedirectLab,
    render: 'ssr',
    notFound: RouteNotFound,
  },
  {
    path: '/stream-ttfb/buffer',
    layout: Layout,
    component: StreamTtfbLab,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/isr-lab',
    layout: Layout,
    component: IsrLab,
    render: 'ssg',
    revalidate: 1,
    getStaticPaths: () => ['/isr-lab'],
  },
  {
    path: '/stream-error/slow',
    layout: Layout,
    component: StreamErrorLab,
    notFound: RouteNotFound,
    render: 'ssr',
  },
  {
    path: '/login',
    layout: Layout,
    component: Login,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/keyed-each-lab',
    layout: Layout,
    component: KeyedEachLab,
    render: 'ssr',
  },
  {
    path: '/named-slots-lab',
    layout: Layout,
    component: NamedSlotsLab,
    render: 'ssr',
  },
  {
    path: '/claim-identity-lab',
    layout: Layout,
    component: ClaimIdentityLab,
    render: 'ssr',
  },
  {
    path: '/crossfade-lab',
    layout: Layout,
    component: CrossfadeLab,
    render: 'ssr',
  },
  {
    path: '/nested-load-lab',
    layout: NestedLoadShell,
    component: NestedLoadLab,
    render: 'ssr',
  },
  {
    path: '/component-bind-lab',
    layout: Layout,
    component: ComponentBindLab,
    render: 'ssr',
  },
  {
    path: '/class-directive-lab',
    layout: Layout,
    component: ClassDirectiveLab,
    render: 'ssr',
  },
  {
    path: '/style-directive-lab',
    layout: Layout,
    component: StyleDirectiveLab,
    render: 'ssr',
  },
  {
    path: '/style-css-var-lab',
    layout: Layout,
    component: StyleCssVarLab,
    render: 'ssr',
  },
  {
    path: '/bind-checked-lab',
    layout: Layout,
    component: BindCheckedLab,
    render: 'ssr',
  },
  {
    path: '/event-dispatcher-lab',
    layout: Layout,
    component: EventDispatcherLab,
    render: 'ssr',
  },
  {
    path: '/use-action-lab',
    layout: Layout,
    component: UseActionLab,
    render: 'ssr',
  },
  {
    path: '/portal-lab',
    layout: Layout,
    component: PortalLab,
    render: 'ssr',
  },
  {
    path: '/click-outside-lab',
    layout: Layout,
    component: ClickOutsideLab,
    render: 'ssr',
  },
  {
    path: '/long-press-lab',
    layout: Layout,
    component: LongPressLab,
    render: 'ssr',
  },
  {
    path: '/hold-repeat-lab',
    layout: Layout,
    component: HoldRepeatLab,
    render: 'ssr',
  },
  {
    path: '/autofocus-lab',
    layout: Layout,
    component: AutofocusLab,
    render: 'ssr',
  },
  {
    path: '/select-on-focus-lab',
    layout: Layout,
    component: SelectOnFocusLab,
    render: 'ssr',
  },
  {
    path: '/trim-lab',
    layout: Layout,
    component: TrimLab,
    render: 'ssr',
  },
  {
    path: '/trim-start-lab',
    layout: Layout,
    component: TrimStartLab,
    render: 'ssr',
  },
  {
    path: '/trim-end-lab',
    layout: Layout,
    component: TrimEndLab,
    render: 'ssr',
  },
  {
    path: '/numeric-lab',
    layout: Layout,
    component: NumericLab,
    render: 'ssr',
  },
  {
    path: '/decimal-lab',
    layout: Layout,
    component: DecimalLab,
    render: 'ssr',
  },
  {
    path: '/hex-lab',
    layout: Layout,
    component: HexLab,
    render: 'ssr',
  },
  {
    path: '/integer-lab',
    layout: Layout,
    component: IntegerLab,
    render: 'ssr',
  },
  {
    path: '/signed-decimal-lab',
    layout: Layout,
    component: SignedDecimalLab,
    render: 'ssr',
  },
  {
    path: '/phone-lab',
    layout: Layout,
    component: PhoneLab,
    render: 'ssr',
  },
  {
    path: '/email-lab',
    layout: Layout,
    component: EmailLab,
    render: 'ssr',
  },
  {
    path: '/url-lab',
    layout: Layout,
    component: UrlLab,
    render: 'ssr',
  },
  {
    path: '/username-lab',
    layout: Layout,
    component: UsernameLab,
    render: 'ssr',
  },
  {
    path: '/credit-card-lab',
    layout: Layout,
    component: CreditCardLab,
    render: 'ssr',
  },
  {
    path: '/postal-code-lab',
    layout: Layout,
    component: PostalCodeLab,
    render: 'ssr',
  },
  {
    path: '/iban-lab',
    layout: Layout,
    component: IbanLab,
    render: 'ssr',
  },
  {
    path: '/cvv-lab',
    layout: Layout,
    component: CvvLab,
    render: 'ssr',
  },
  {
    path: '/otp-lab',
    layout: Layout,
    component: OtpLab,
    render: 'ssr',
  },
  {
    path: '/collapse-whitespace-lab',
    layout: Layout,
    component: CollapseWhitespaceLab,
    render: 'ssr',
  },
  {
    path: '/remove-whitespace-lab',
    layout: Layout,
    component: RemoveWhitespaceLab,
    render: 'ssr',
  },
  {
    path: '/remove-diacritics-lab',
    layout: Layout,
    component: RemoveDiacriticsLab,
    render: 'ssr',
  },
  {
    path: '/initials-lab',
    layout: Layout,
    component: InitialsLab,
    render: 'ssr',
  },
  {
    path: '/sentence-case-lab',
    layout: Layout,
    component: SentenceCaseLab,
    render: 'ssr',
  },
  {
    path: '/camel-case-lab',
    layout: Layout,
    component: CamelCaseLab,
    render: 'ssr',
  },
  {
    path: '/snake-case-lab',
    layout: Layout,
    component: SnakeCaseLab,
    render: 'ssr',
  },
  {
    path: '/kebab-case-lab',
    layout: Layout,
    component: KebabCaseLab,
    render: 'ssr',
  },
  {
    path: '/constant-case-lab',
    layout: Layout,
    component: ConstantCaseLab,
    render: 'ssr',
  },
  {
    path: '/pascal-case-lab',
    layout: Layout,
    component: PascalCaseLab,
    render: 'ssr',
  },
  {
    path: '/dot-case-lab',
    layout: Layout,
    component: DotCaseLab,
    render: 'ssr',
  },
  {
    path: '/path-case-lab',
    layout: Layout,
    component: PathCaseLab,
    render: 'ssr',
  },
  {
    path: '/train-case-lab',
    layout: Layout,
    component: TrainCaseLab,
    render: 'ssr',
  },
  {
    path: '/swap-case-lab',
    layout: Layout,
    component: SwapCaseLab,
    render: 'ssr',
  },
  {
    path: '/reverse-lab',
    layout: Layout,
    component: ReverseLab,
    render: 'ssr',
  },
  {
    path: '/expiry-lab',
    layout: Layout,
    component: ExpiryLab,
    render: 'ssr',
  },
  {
    path: '/letters-lab',
    layout: Layout,
    component: LettersLab,
    render: 'ssr',
  },
  {
    path: '/pin-lab',
    layout: Layout,
    component: PinLab,
    render: 'ssr',
  },
  {
    path: '/ascii-lab',
    layout: Layout,
    component: AsciiLab,
    render: 'ssr',
  },
  {
    path: '/remove-punct-lab',
    layout: Layout,
    component: RemovePunctLab,
    render: 'ssr',
  },
  {
    path: '/currency-lab',
    layout: Layout,
    component: CurrencyLab,
    render: 'ssr',
  },
  {
    path: '/percent-lab',
    layout: Layout,
    component: PercentLab,
    render: 'ssr',
  },
  {
    path: '/alphanumeric-lab',
    layout: Layout,
    component: AlphanumericLab,
    render: 'ssr',
  },
  {
    path: '/slugify-lab',
    layout: Layout,
    component: SlugifyLab,
    render: 'ssr',
  },
  {
    path: '/capitalize-lab',
    layout: Layout,
    component: CapitalizeLab,
    render: 'ssr',
  },
  {
    path: '/max-length-lab',
    layout: Layout,
    component: MaxLengthLab,
    render: 'ssr',
  },
  {
    path: '/lowercase-lab',
    layout: Layout,
    component: LowercaseLab,
    render: 'ssr',
  },
  {
    path: '/uppercase-lab',
    layout: Layout,
    component: UppercaseLab,
    render: 'ssr',
  },
  {
    path: '/auto-height-lab',
    layout: Layout,
    component: AutoHeightLab,
    render: 'ssr',
  },
  {
    path: '/debounce-lab',
    layout: Layout,
    component: DebounceLab,
    render: 'ssr',
  },
  {
    path: '/throttle-lab',
    layout: Layout,
    component: ThrottleLab,
    render: 'ssr',
  },
  {
    path: '/change-lab',
    layout: Layout,
    component: ChangeLab,
    render: 'ssr',
  },
  {
    path: '/input-lab',
    layout: Layout,
    component: InputLab,
    render: 'ssr',
  },
  {
    path: '/submit-lab',
    layout: Layout,
    component: SubmitLab,
    render: 'ssr',
  },
  {
    path: '/formdata-lab',
    layout: Layout,
    component: FormDataLab,
    render: 'ssr',
  },
  {
    path: '/reset-lab',
    layout: Layout,
    component: ResetLab,
    render: 'ssr',
  },
  {
    path: '/invalid-lab',
    layout: Layout,
    component: InvalidLab,
    render: 'ssr',
  },
  {
    path: '/copy-lab',
    layout: Layout,
    component: CopyLab,
    render: 'ssr',
  },
  {
    path: '/paste-lab',
    layout: Layout,
    component: PasteLab,
    render: 'ssr',
  },
  {
    path: '/cut-lab',
    layout: Layout,
    component: CutLab,
    render: 'ssr',
  },
  {
    path: '/beforeinput-lab',
    layout: Layout,
    component: BeforeinputLab,
    render: 'ssr',
  },
  {
    path: '/composition-lab',
    layout: Layout,
    component: CompositionLab,
    render: 'ssr',
  },
  {
    path: '/selectionchange-lab',
    layout: Layout,
    component: SelectionchangeLab,
    render: 'ssr',
  },
  {
    path: '/hover-lab',
    layout: Layout,
    component: HoverLab,
    render: 'ssr',
  },
  {
    path: '/dblclick-lab',
    layout: Layout,
    component: DblclickLab,
    render: 'ssr',
  },
  {
    path: '/contextmenu-lab',
    layout: Layout,
    component: ContextmenuLab,
    render: 'ssr',
  },
  {
    path: '/wheel-lab',
    layout: Layout,
    component: WheelLab,
    render: 'ssr',
  },
  {
    path: '/scroll-lab',
    layout: Layout,
    component: ScrollLab,
    render: 'ssr',
  },
  {
    path: '/snap-lab',
    layout: Layout,
    component: SnapLab,
    render: 'ssr',
  },
  {
    path: '/pressed-lab',
    layout: Layout,
    component: PressedLab,
    render: 'ssr',
  },
  {
    path: '/focus-lab',
    layout: Layout,
    component: FocusLab,
    render: 'ssr',
  },
  {
    path: '/focus-within-lab',
    layout: Layout,
    component: FocusWithinLab,
    render: 'ssr',
  },
  {
    path: '/focus-visible-lab',
    layout: Layout,
    component: FocusVisibleLab,
    render: 'ssr',
  },
  {
    path: '/download-lab',
    layout: Layout,
    component: DownloadLab,
    render: 'ssr',
  },
  {
    path: '/fullscreen-lab',
    layout: Layout,
    component: FullscreenLab,
    render: 'ssr',
  },
  {
    path: '/resize-lab',
    layout: Layout,
    component: ResizeLab,
    render: 'ssr',
  },
  {
    path: '/swipe-lab',
    layout: Layout,
    component: SwipeLab,
    render: 'ssr',
  },
  {
    path: '/pinch-lab',
    layout: Layout,
    component: PinchLab,
    render: 'ssr',
  },
  {
    path: '/tooltip-lab',
    layout: Layout,
    component: TooltipLab,
    render: 'ssr',
  },
  {
    path: '/mutate-lab',
    layout: Layout,
    component: MutateLab,
    render: 'ssr',
  },
  {
    path: '/sticky-lab',
    layout: Layout,
    component: StickyLab,
    render: 'ssr',
  },
  {
    path: '/drag-lab',
    layout: Layout,
    component: DragLab,
    render: 'ssr',
  },
  {
    path: '/dropzone-lab',
    layout: Layout,
    component: DropzoneLab,
    render: 'ssr',
  },
  {
    path: '/focus-trap-lab',
    layout: Layout,
    component: FocusTrapLab,
    render: 'ssr',
  },
  {
    path: '/lock-scroll-lab',
    layout: Layout,
    component: LockScrollLab,
    render: 'ssr',
  },
  {
    path: '/escape-key-lab',
    layout: Layout,
    component: EscapeKeyLab,
    render: 'ssr',
  },
  {
    path: '/in-view-lab',
    layout: Layout,
    component: InViewLab,
    render: 'ssr',
  },
  {
    path: '/scroll-into-view-lab',
    layout: Layout,
    component: ScrollIntoViewLab,
    render: 'ssr',
  },
  {
    path: '/infinite-scroll-lab',
    layout: Layout,
    component: InfiniteScrollLab,
    render: 'ssr',
  },
  {
    path: '/reveal-lab',
    layout: Layout,
    component: RevealLab,
    render: 'ssr',
  },
  {
    path: '/lazy-lab',
    layout: Layout,
    component: LazyLab,
    render: 'ssr',
  },
  {
    path: '/scrollspy-lab',
    layout: Layout,
    component: ScrollspyLab,
    render: 'ssr',
  },
  {
    path: '/hotkey-lab',
    layout: Layout,
    component: HotkeyLab,
    render: 'ssr',
  },
  {
    path: '/keydown-lab',
    layout: Layout,
    component: KeydownLab,
    render: 'ssr',
  },
  {
    path: '/keyup-lab',
    layout: Layout,
    component: KeyupLab,
    render: 'ssr',
  },
  {
    path: '/bind-this-lab',
    layout: Layout,
    component: BindThisLab,
    render: 'ssr',
  },
  {
    path: '/bind-group-lab',
    layout: Layout,
    component: BindGroupLab,
    render: 'ssr',
  },
  {
    path: '/transition-fade-lab',
    layout: Layout,
    component: TransitionFadeLab,
    render: 'ssr',
  },
  {
    path: '/transition-delay-lab',
    layout: Layout,
    component: TransitionDelayLab,
    render: 'ssr',
  },
  {
    path: '/transition-easing-lab',
    layout: Layout,
    component: TransitionEasingLab,
    render: 'ssr',
  },
  {
    path: '/tick-lab',
    layout: Layout,
    component: TickLab,
    render: 'ssr',
  },
  {
    path: '/untrack-lab',
    layout: Layout,
    component: UntrackLab,
    render: 'ssr',
  },
  {
    path: '/context-lab',
    layout: Layout,
    component: ContextLab,
    render: 'ssr',
  },
  {
    path: '/all-contexts-lab',
    layout: Layout,
    component: AllContextsLab,
    render: 'ssr',
  },
  {
    path: '/update-hooks-lab',
    layout: Layout,
    component: UpdateHooksLab,
    render: 'ssr',
  },
  {
    path: '/media-query-lab',
    layout: Layout,
    component: MediaQueryLab,
    render: 'ssr',
  },
  {
    path: '/prefers-reduced-motion-lab',
    layout: Layout,
    component: PrefersReducedMotionLab,
    render: 'ssr',
  },
  {
    path: '/prefers-color-scheme-lab',
    layout: Layout,
    component: PrefersColorSchemeLab,
    render: 'ssr',
  },
  {
    path: '/prefers-contrast-lab',
    layout: Layout,
    component: PrefersContrastLab,
    render: 'ssr',
  },
  {
    path: '/prefers-reduced-transparency-lab',
    layout: Layout,
    component: PrefersReducedTransparencyLab,
    render: 'ssr',
  },
  {
    path: '/prefers-reduced-data-lab',
    layout: Layout,
    component: PrefersReducedDataLab,
    render: 'ssr',
  },
  {
    path: '/save-data-signal-lab',
    layout: Layout,
    component: SaveDataSignalLab,
    render: 'ssr',
  },
  {
    path: '/connection-effective-type-lab',
    layout: Layout,
    component: ConnectionEffectiveTypeLab,
    render: 'ssr',
  },
  {
    path: '/connection-downlink-lab',
    layout: Layout,
    component: ConnectionDownlinkLab,
    render: 'ssr',
  },
  {
    path: '/connection-rtt-lab',
    layout: Layout,
    component: ConnectionRttLab,
    render: 'ssr',
  },
  {
    path: '/forced-colors-lab',
    layout: Layout,
    component: ForcedColorsLab,
    render: 'ssr',
  },
  {
    path: '/inverted-colors-lab',
    layout: Layout,
    component: InvertedColorsLab,
    render: 'ssr',
  },
  {
    path: '/window-size-lab',
    layout: Layout,
    component: WindowSizeLab,
    render: 'ssr',
  },
  {
    path: '/page-scroll-lab',
    layout: Layout,
    component: PageScrollLab,
    render: 'ssr',
  },
  {
    path: '/device-pixel-ratio-lab',
    layout: Layout,
    component: DevicePixelRatioLab,
    render: 'ssr',
  },
  {
    path: '/persisted-signal-lab',
    layout: Layout,
    component: PersistedSignalLab,
    render: 'ssr',
  },
  {
    path: '/online-signal-lab',
    layout: Layout,
    component: OnlineSignalLab,
    render: 'ssr',
  },
  {
    path: '/now-signal-lab',
    layout: Layout,
    component: NowSignalLab,
    render: 'ssr',
  },
  {
    path: '/idle-signal-lab',
    layout: Layout,
    component: IdleSignalLab,
    render: 'ssr',
  },
  {
    path: '/locale-signal-lab',
    layout: Layout,
    component: LocaleSignalLab,
    render: 'ssr',
  },
  {
    path: '/locales-signal-lab',
    layout: Layout,
    component: LocalesSignalLab,
    render: 'ssr',
  },
  {
    path: '/time-zone-signal-lab',
    layout: Layout,
    component: TimeZoneSignalLab,
    render: 'ssr',
  },
  {
    path: '/hardware-concurrency-lab',
    layout: Layout,
    component: HardwareConcurrencyLab,
    render: 'ssr',
  },
  {
    path: '/device-memory-lab',
    layout: Layout,
    component: DeviceMemoryLab,
    render: 'ssr',
  },
  {
    path: '/user-agent-lab',
    layout: Layout,
    component: UserAgentLab,
    render: 'ssr',
  },
  {
    path: '/do-not-track-lab',
    layout: Layout,
    component: DoNotTrackLab,
    render: 'ssr',
  },
  {
    path: '/vendor-lab',
    layout: Layout,
    component: VendorLab,
    render: 'ssr',
  },
  {
    path: '/app-version-lab',
    layout: Layout,
    component: AppVersionLab,
    render: 'ssr',
  },
  {
    path: '/product-lab',
    layout: Layout,
    component: ProductLab,
    render: 'ssr',
  },
  {
    path: '/app-name-lab',
    layout: Layout,
    component: AppNameLab,
    render: 'ssr',
  },
  {
    path: '/platform-lab',
    layout: Layout,
    component: PlatformLab,
    render: 'ssr',
  },
  {
    path: '/app-code-name-lab',
    layout: Layout,
    component: AppCodeNameLab,
    render: 'ssr',
  },
  {
    path: '/max-touch-points-lab',
    layout: Layout,
    component: MaxTouchPointsLab,
    render: 'ssr',
  },
  {
    path: '/cookie-enabled-lab',
    layout: Layout,
    component: CookieEnabledLab,
    render: 'ssr',
  },
  {
    path: '/pdf-viewer-enabled-lab',
    layout: Layout,
    component: PdfViewerEnabledLab,
    render: 'ssr',
  },
  {
    path: '/webdriver-lab',
    layout: Layout,
    component: WebdriverLab,
    render: 'ssr',
  },
  {
    path: '/storage-estimate-lab',
    layout: Layout,
    component: StorageEstimateLab,
    render: 'ssr',
  },
  {
    path: '/storage-persisted-lab',
    layout: Layout,
    component: StoragePersistedLab,
    render: 'ssr',
  },
  {
    path: '/hash-signal-lab',
    layout: Layout,
    component: HashSignalLab,
    render: 'ssr',
  },
  {
    path: '/search-params-signal-lab',
    layout: Layout,
    component: SearchParamsSignalLab,
    render: 'ssr',
  },
  {
    path: '/pathname-signal-lab',
    layout: Layout,
    component: PathnameSignalLab,
    render: 'ssr',
  },
  {
    path: '/document-title-signal-lab',
    layout: Layout,
    component: DocumentTitleSignalLab,
    render: 'ssr',
  },
  {
    path: '/html-lang-signal-lab',
    layout: Layout,
    component: HtmlLangSignalLab,
    render: 'ssr',
  },
  {
    path: '/html-dir-signal-lab',
    layout: Layout,
    component: HtmlDirSignalLab,
    render: 'ssr',
  },
  {
    path: '/visibility-signal-lab',
    layout: Layout,
    component: VisibilitySignalLab,
    render: 'ssr',
  },
  {
    path: '/active-element-lab',
    layout: Layout,
    component: ActiveElementLab,
    render: 'ssr',
  },
  {
    path: '/soft-hydrate-focus-lab',
    layout: Layout,
    component: SoftHydrateFocusLab,
    render: 'ssr',
  },
  {
    path: '/soft-hydrate-form-lab',
    layout: Layout,
    component: SoftHydrateFormLab,
    render: 'ssr',
  },
  {
    path: '/soft-hydrate-scroll-lab',
    layout: Layout,
    component: SoftHydrateScrollLab,
    render: 'ssr',
  },
  {
    path: '/batch-lab',
    layout: Layout,
    component: BatchLab,
    render: 'ssr',
  },
  {
    path: '/readonly-lab',
    layout: Layout,
    component: ReadonlyLab,
    render: 'ssr',
  },
  {
    path: '/tweened-lab',
    layout: Layout,
    component: TweenedLab,
    render: 'ssr',
  },
  {
    path: '/spring-lab',
    layout: Layout,
    component: SpringLab,
    render: 'ssr',
  },
  {
    path: '/soft-hydrate-open-lab',
    layout: Layout,
    component: SoftHydrateOpenLab,
    render: 'ssr',
  },
  {
    path: '/lifecycle-lab',
    layout: Layout,
    component: LifecycleLab,
    render: 'ssr',
  },
  {
    path: '/page-title-lab',
    layout: Layout,
    component: PageTitleLab,
    render: 'ssr',
  },
  {
    path: '/component-destroy-lab',
    layout: Layout,
    component: ComponentDestroyLab,
    render: 'ssr',
  },
  {
    path: '/signal-effect-lab',
    layout: Layout,
    component: SignalEffectLab,
    render: 'ssr',
  },
  {
    path: '/else-if-lab',
    layout: Layout,
    component: ElseIfLab,
    render: 'ssr',
  },
  {
    path: '/each-else-lab',
    layout: Layout,
    component: EachElseLab,
    render: 'ssr',
  },
  {
    path: '/const-lab',
    layout: Layout,
    component: ConstLab,
    render: 'ssr',
  },
  {
    path: '/await-pending-lab',
    layout: Layout,
    component: AwaitPendingLab,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/event-modifiers-lab',
    layout: Layout,
    component: EventModifiersLab,
    render: 'ssr',
  },
  {
    path: '/comment-lab',
    layout: Layout,
    component: CommentLab,
    render: 'ssg',
  },
  {
    path: '/await-then-lab',
    layout: Layout,
    component: AwaitThenLab,
    render: 'ssr',
    bufferHtml: true,
  },
  {
    path: '/boolean-attr-lab',
    layout: Layout,
    component: BooleanAttrLab,
    render: 'ssr',
  },
  {
    path: '/select-bind-lab',
    layout: Layout,
    component: SelectBindLab,
    render: 'ssr',
  },
  {
    path: '/number-bind-lab',
    layout: Layout,
    component: NumberBindLab,
    render: 'ssr',
  },
  {
    path: '/multi-select-bind-lab',
    layout: Layout,
    component: MultiSelectBindLab,
    render: 'ssr',
  },
  {
    path: '/fade-outro-lab',
    layout: Layout,
    component: FadeOutroLab,
    render: 'ssr',
  },
  {
    path: '/reduced-motion-transition-lab',
    layout: Layout,
    component: ReducedMotionTransitionLab,
    render: 'ssr',
  },
  {
    path: '/keyed-outro-lab',
    layout: Layout,
    component: KeyedOutroLab,
    render: 'ssr',
  },
  {
    path: '/fly-lab',
    layout: Layout,
    component: FlyLab,
    render: 'ssr',
  },
  {
    path: '/in-out-lab',
    layout: Layout,
    component: InOutLab,
    render: 'ssr',
  },
  {
    path: '/slide-lab',
    layout: Layout,
    component: SlideLab,
    render: 'ssr',
  },
  {
    path: '/slidex-lab',
    layout: Layout,
    component: SlideXLab,
    render: 'ssr',
  },
  {
    path: '/scale-lab',
    layout: Layout,
    component: ScaleLab,
    render: 'ssr',
  },
  {
    path: '/spin-lab',
    layout: Layout,
    component: SpinLab,
    render: 'ssr',
  },
  {
    path: '/pop-lab',
    layout: Layout,
    component: PopLab,
    render: 'ssr',
  },
  {
    path: '/bounce-lab',
    layout: Layout,
    component: BounceLab,
    render: 'ssr',
  },
  {
    path: '/drop-lab',
    layout: Layout,
    component: DropLab,
    render: 'ssr',
  },
  {
    path: '/shake-lab',
    layout: Layout,
    component: ShakeLab,
    render: 'ssr',
  },
  {
    path: '/flip-lab',
    layout: Layout,
    component: FlipLab,
    render: 'ssr',
  },
  {
    path: '/pulse-lab',
    layout: Layout,
    component: PulseLab,
    render: 'ssr',
  },
  {
    path: '/wipe-lab',
    layout: Layout,
    component: WipeLab,
    render: 'ssr',
  },
  {
    path: '/skew-lab',
    layout: Layout,
    component: SkewLab,
    render: 'ssr',
  },
  {
    path: '/roll-lab',
    layout: Layout,
    component: RollLab,
    render: 'ssr',
  },
  {
    path: '/zoom-lab',
    layout: Layout,
    component: ZoomLab,
    render: 'ssr',
  },
  {
    path: '/blur-lab',
    layout: Layout,
    component: BlurLab,
    render: 'ssr',
  },
  {
    path: '/spread-lab',
    layout: Layout,
    component: SpreadLab,
    render: 'ssr',
  },
  {
    path: '/comp-spread-lab',
    layout: Layout,
    component: CompSpreadLab,
    render: 'ssr',
  },
  {
    path: '/files-bind-lab',
    layout: Layout,
    component: FilesBindLab,
    render: 'ssr',
  },
  {
    path: '/dimension-bind-lab',
    layout: Layout,
    component: DimensionBindLab,
    render: 'ssr',
  },
  {
    path: '/scroll-bind-lab',
    layout: Layout,
    component: ScrollBindLab,
    render: 'ssr',
  },
  {
    path: '/selection-bind-lab',
    layout: Layout,
    component: SelectionBindLab,
    render: 'ssr',
  },
  {
    path: '/indeterminate-bind-lab',
    layout: Layout,
    component: IndeterminateBindLab,
    render: 'ssr',
  },
  {
    path: '/open-bind-lab',
    layout: Layout,
    component: OpenBindLab,
    render: 'ssr',
  },
  {
    path: '/media-bind-lab',
    layout: Layout,
    component: MediaBindLab,
    render: 'ssr',
  },
  {
    path: '/media-ended-lab',
    layout: Layout,
    component: MediaEndedLab,
    render: 'ssr',
  },
  {
    path: '/media-played-lab',
    layout: Layout,
    component: MediaPlayedLab,
    render: 'ssr',
  },
  {
    path: '/media-seekable-lab',
    layout: Layout,
    component: MediaSeekableLab,
    render: 'ssr',
  },
  {
    path: '/media-ready-state-lab',
    layout: Layout,
    component: MediaReadyStateLab,
    render: 'ssr',
  },
  {
    path: '/media-network-state-lab',
    layout: Layout,
    component: MediaNetworkStateLab,
    render: 'ssr',
  },
  {
    path: '/media-video-size-lab',
    layout: Layout,
    component: MediaVideoSizeLab,
    render: 'ssr',
  },
  {
    path: '/image-natural-size-lab',
    layout: Layout,
    component: ImageNaturalSizeLab,
    render: 'ssr',
  },
  {
    path: '/textcontent-bind-lab',
    layout: Layout,
    component: TextContentBindLab,
    render: 'ssr',
  },
  {
    path: '/innertext-bind-lab',
    layout: Layout,
    component: InnerTextBindLab,
    render: 'ssr',
  },
  {
    path: '/draw-lab',
    layout: Layout,
    component: DrawLab,
    render: 'ssr',
  },
  {
    path: '/admin',
    layout: Layout,
    component: Admin,
    render: 'csr',
    guard: requireSession(),
    error: AdminError,
  },
  {
    path: '/error-lab/nf',
    layout: Layout,
    component: ErrorLabNf,
    notFound: RouteNotFound,
    render: 'ssr',
  },
  {
    path: '/error-lab/boom',
    layout: Layout,
    component: ErrorLabBoom,
    error: RouteError,
    render: 'ssr',
  },
  {
    path: '/error-lab/global-nf',
    layout: Layout,
    component: ErrorLabPlainNf,
    render: 'ssr',
  },
  {
    path: '/error-lab',
    component: ErrorLabParent,
    error: RouteError,
    children: [
      {
        path: 'nested-boom',
        layout: Layout,
        component: ErrorLabNestedBoom,
        render: 'ssr',
      },
    ],
  },
])

export default routes
export { routes }
