import type { DiscoveryEntry, DiscoveryGoal } from "./types";
import { databaseFormatDiscoveryEntries } from "./databaseFormatArchive";
import { jingleDiscoveryEntries } from "./jingleArchive";
import { videoMemeDiscoveryEntries } from "./videoMemeArchive";

const selfieNineDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "petal-umbrella",
    brand: "Surreal portrait series",
    title: "One selfie, nine impossible scenes",
    curatorNote: "A single recognizable subject carries the same quiet editorial language across nine surreal compositions.",
  },
  {
    id: "cloud",
    brand: "Cloud",
    title: "A nap in mid-air",
    curatorNote: "Dense cloud texture and generous negative space turn the same selfie into a quiet dream.",
  },
  {
    id: "chair",
    brand: "Chair",
    title: "Sitting above the pavement",
    curatorNote: "An ordinary worn chair becomes strange through one clean, visible air gap.",
  },
  {
    id: "mirror",
    brand: "Mirror",
    title: "Standing on a reflection",
    curatorNote: "The reflected boots make an impossible floating mirror feel physically present.",
  },
  {
    id: "staircase",
    brand: "Staircase",
    title: "Climbing toward nothing",
    curatorNote: "A calm walking pose holds together while the final steps dissolve into dust.",
  },
  {
    id: "bed",
    brand: "Bed",
    title: "Resting above concrete",
    curatorNote: "Heavy white bedding and a relaxed pose make the floating bed feel unexpectedly believable.",
  },
  {
    id: "phone-booth",
    brand: "Phone booth",
    title: "A call suspended in time",
    curatorNote: "Clear glass, a loose receiver cord, and frozen pigeons keep every layer readable.",
  },
  {
    id: "grocery-cart",
    brand: "Grocery cart",
    title: "Shopping without gravity",
    curatorNote: "The same subject stays relaxed inside detailed wire mesh while bags float around the cart.",
  },
  {
    id: "door",
    brand: "Door",
    title: "Walking out of nowhere",
    curatorNote: "A detached door, readable mid-step pose, and large empty air gap complete the impossible transition.",
  },
].map((proof, index) => ({
  ...proof,
  id: `selfie-nine-images-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 18 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/selfie-nine-images-v1/assets/source/${proof.id}.jpg`,
    referenceSrc: "/format-repositories/selfie-nine-images-v1/assets/source/original-selfie.jpg",
    durationLabel: "Static",
  },
  format: {
    slug: "selfie-nine-images",
    name: "1 Selfie, 9 Images",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const ragDollDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "red-door",
    brand: "Identity preservation",
    title: "Every accessory becomes felt",
    curatorNote: "The seated pose, expression, jewelry, handbag, and red doorway survive as tactile handcrafted details.",
    image: "02",
  },
  {
    id: "cover",
    brand: "Felt transformation",
    title: "Turn any portrait into handmade felt",
    curatorNote: "The branded source cover establishes the complete wool-and-stitching transformation.",
    image: "01",
  },
  {
    id: "phone-booth",
    brand: "Environment transformation",
    title: "A whole London street in wool",
    curatorNote: "The person remains recognizable while glass, brick, pavement, and the phone booth become one coherent felt world.",
    image: "03",
  },
  {
    id: "cafe-couple",
    brand: "Two-person portrait",
    title: "Two people, one felt world",
    curatorNote: "Two distinct faces and a shared pose remain legible inside a detailed handmade café scene.",
    image: "04",
  },
  {
    id: "juice",
    brand: "Material detail",
    title: "Tiny fibers hold the likeness",
    curatorNote: "Hair, skin, clothing, the drink, and the background all carry visible wool fibers without losing the subject.",
    image: "05",
  },
  {
    id: "car-bouquet",
    brand: "Lifestyle portrait",
    title: "Soft materials, same moment",
    curatorNote: "The bouquet, car interior, outfit, and relaxed pose become plush while preserving the original composition.",
    image: "06",
  },
  {
    id: "doorway",
    brand: "Fashion portrait",
    title: "Fashion becomes handcrafted",
    curatorNote: "Layered fabric, stitching, and soft stuffing carry the outfit and doorway into a polished stop-motion world.",
    image: "07",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `rag-doll-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 27 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/rag-doll-v1/assets/source/carousel-${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "rag-doll",
    name: "Rag Doll",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const productPhotoshootDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "gift",
    title: "Gift-ready without the studio",
    curatorNote: "A warm gift scene keeps the real tin and cookies recognizable while adding occasion and polish.",
  },
  {
    id: "hero",
    title: "A clean product hero",
    curatorNote: "The exact product becomes a crisp ecommerce hero with controlled color, spacing, and light.",
  },
  {
    id: "lifestyle",
    title: "The product in use",
    curatorNote: "Hands, crumbs, and serving details create a believable lifestyle moment around the same product.",
  },
  {
    id: "seasonal",
    title: "Ready for the holiday campaign",
    curatorNote: "Seasonal props change the campaign mood without changing the product customers will receive.",
  },
  {
    id: "social",
    title: "Built for the feed",
    curatorNote: "A bold branded composition turns the packshot into a graphic social ad.",
  },
  {
    id: "surface",
    title: "A polished tabletop shot",
    curatorNote: "A simple kitchen surface gives the product a natural commercial setting with room to breathe.",
  },
].map((proof, index) => ({
  ...proof,
  id: `product-photoshoot-davids-meltaways-${proof.id}`,
  status: "published",
  order: 5.1 + index / 10,
  brand: "David's Cookies",
  goal: "sell",
  media: {
    kind: "image",
    src: `/discovery/product-photoshoot/davids-meltaways-${proof.id}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "product-photoshoot",
    name: "Product Photoshoot",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const moodNotesDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "poolside",
    brand: "Personal visual journal",
    title: "Turn a real moment into Mood Notes",
    curatorNote: "Scene-specific handwriting, restrained doodles, and a glass music player turn one lifestyle photo into a personal journal page.",
    image: "example-output",
  },
  {
    id: "matcha",
    brand: "Everyday details",
    title: "Small objects carry the mood",
    curatorNote: "The matcha, sunglasses, and bag each receive one short observation while the original scene stays intact.",
    image: "example-02",
  },
  {
    id: "garden",
    brand: "Lifestyle portrait",
    title: "A relaxed portrait gets its soundtrack",
    curatorNote: "Notes describe the jacket, shades, greenery, and calm energy without crowding the seated subject.",
    image: "example-03",
  },
  {
    id: "mirror",
    brand: "Mirror selfie",
    title: "An outfit becomes a memory page",
    curatorNote: "Readable arrows connect quick thoughts to the phone, bag, outfit, and room light.",
    image: "example-04",
  },
  {
    id: "beach",
    brand: "Golden hour",
    title: "Beach light sets the whole interface",
    curatorNote: "The warm music card and white notes echo the hat, drink, jewelry, and sunlit atmosphere.",
    image: "example-05",
  },
  {
    id: "street",
    brand: "Travel journal",
    title: "A city walk gets annotated",
    curatorNote: "Architecture, clothing, and the pace of the walk become personal cues while the street portrait keeps its negative space.",
    image: "example-06",
  },
  {
    id: "market",
    brand: "Colorful moment",
    title: "Food, texture, and color become notes",
    curatorNote: "The annotations and music interface follow the market scene's playful details and palette.",
    image: "example-07",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `mood-notes-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 34 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/mood-notes-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/mood-notes-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "mood-notes",
    name: "Mood Notes",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const redDeadRedemptionDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "frontier-portrait",
    brand: "Character transformation",
    title: "Turn a portrait into a frontier cutscene",
    curatorNote: "The original face and centered framing survive a richly textured 1899 Western video-game transformation.",
    image: "example-output",
  },
  {
    id: "main-street",
    brand: "Frontier character",
    title: "A modern headshot becomes a gunslinger",
    curatorNote: "Hat, coat, vest, gun belt, dust, and golden light relocate the same person to a frontier main street.",
    image: "example-02",
  },
  {
    id: "ranch-porch",
    brand: "Ranch scene",
    title: "The portrait moves onto a ranch porch",
    curatorNote: "The face stays recognizable while the cabin, mountains, leather, and period weapons form one coherent scene.",
    image: "example-03",
  },
  {
    id: "winter-saloon",
    brand: "Seasonal Western",
    title: "Holiday warmth survives the Western rewrite",
    curatorNote: "Firelight and Christmas details support the character instead of breaking the dusty game-world atmosphere.",
    image: "example-04",
  },
  {
    id: "cabin",
    brand: "Rugged portrait",
    title: "A clean selfie becomes a cabin character",
    curatorNote: "Weathered fabric, revolvers, a stove, and volumetric sunbeams deliver the AAA Western finish.",
    image: "example-05",
  },
  {
    id: "saloon",
    brand: "In-game cutscene",
    title: "A studio portrait becomes a saloon scene",
    curatorNote: "Restrained period styling preserves identity while the bar and practical lighting establish an in-game cutscene.",
    image: "example-06",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `red-dead-redemption-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 41 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/red-dead-redemption-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/red-dead-redemption-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "red-dead-redemption",
    name: "Red Dead Redemption",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const oldMoneyShotDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "roadster-portrait",
    brand: "Old-money editorial",
    title: "Turn a portrait into a timeless film still",
    curatorNote: "A low camera, classic roadster, open collar, deep contrast, and tactile grain turn one modern portrait into a confident monochrome editorial.",
    image: "example-output",
  },
  {
    id: "windblown",
    brand: "Candid portrait",
    title: "Wind and posture carry the mood",
    curatorNote: "The off-camera gaze and windblown hair keep the polished scene from feeling staged.",
    image: "example-02",
  },
  {
    id: "roadster-stance",
    brand: "Tailored portrait",
    title: "A full stance keeps every detail readable",
    curatorNote: "High-waisted trousers, relaxed hands, chrome, grassland, and cloudy sky all survive the monochrome grade.",
    image: "example-03",
  },
  {
    id: "roadside-seat",
    brand: "Roadside editorial",
    title: "A seated portrait still feels cinematic",
    curatorNote: "Deep blacks in the trousers and car balance the bright shirt, open sky, and self-possessed gaze.",
    image: "example-04",
  },
  {
    id: "field-roadster",
    brand: "Minimal styling",
    title: "Simple styling lets the subject lead",
    curatorNote: "The quiet field and vintage car provide depth without pulling attention away from the person.",
    image: "example-05",
  },
  {
    id: "glasses",
    brand: "Accessory detail",
    title: "Accessories survive the film recipe",
    curatorNote: "Glasses, tousled hair, shirt texture, and polished bodywork remain legible through soft daylight and grain.",
    image: "example-06",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `old-money-shot-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 48 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/old-money-shot-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/old-money-shot-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "old-money-shot",
    name: "Old Money Shot",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const chromeVoidDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "red-jacket-street",
    brand: "Surreal streetwear",
    title: "Turn a fashion portrait into living chrome",
    curatorNote: "The person, red jacket, denim, pose, and street camera remain intact while reflective liquid-metal sculpture grows through the scene.",
    image: "example-output",
  },
  {
    id: "boutique-mirror",
    brand: "Mirror selfie",
    title: "Keep the casual pose. Rebuild the environment.",
    curatorNote: "The phone, shopping bag, layered outfit, and proportions survive while chrome branches create believable boutique depth.",
    image: "example-02",
  },
  {
    id: "green-knit",
    brand: "Texture proof",
    title: "Soft knit stays readable beside hard chrome",
    curatorNote: "Dress texture, boots, bag, crossed arms, and face remain clear while metallic forms curve around the subject.",
    image: "example-03",
  },
  {
    id: "layered-mini",
    brand: "Fashion editorial",
    title: "Preserve every layer inside a surreal set",
    curatorNote: "Hair, shoulder pose, dress, bag, and tall boots keep their color and shape across foreground and background chrome.",
    image: "example-04",
  },
  {
    id: "city-layers",
    brand: "City portrait",
    title: "Make the effect feel planted on the sidewalk",
    curatorNote: "Reflections and occlusion place the chrome convincingly without replacing the cap, jewelry, jacket, jeans, or gaze.",
    image: "example-05",
  },
  {
    id: "graphic-knit",
    brand: "Accessory detail",
    title: "Keep the graphics, glasses, cup, and full pose",
    curatorNote: "The metallic sculpture adds spectacle while the original streetwear portrait stays recognizable down to the accessories.",
    image: "example-06",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `chrome-void-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 55 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/chrome-void-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/chrome-void-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "chrome-void",
    name: "Chrome Void",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const ccdJpegFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "lakeside-speedboat",
    brand: "Archived lake night",
    title: "Turn a clean snapshot into a believable CCD JPEG",
    curatorNote: "The composition stays intact while dense electronic noise, soft optics, imperfect exposure, and compression make the file feel genuinely old.",
    image: "example-output",
  },
  {
    id: "red-car-night",
    brand: "Direct-flash nightlife",
    title: "Keep the pose. Break the modern polish.",
    curatorNote: "Hard flash, crushed shadows, chroma noise, and texture smearing degrade the file without replacing the subject or red car.",
    image: "example-02",
  },
  {
    id: "phone-booth",
    brand: "Phone-booth portrait",
    title: "Make compression part of the memory",
    curatorNote: "The phone, suit, booth, and graffiti remain recognizable while early-social JPEG damage softens every surface.",
    image: "example-03",
  },
  {
    id: "parking-lot-lighter",
    brand: "Parking-lot flash",
    title: "Underexpose it like a cheap automatic camera",
    curatorNote: "The lighter, jewelry, jacket, and empty lot survive beneath noisy shadows, weak sharpening, and imperfect white balance.",
    image: "example-04",
  },
  {
    id: "airport-flowers",
    brand: "Airport snapshot",
    title: "Daylight can still feel downloaded and reshared",
    curatorNote: "Flowers, clothing, airplane, and tarmac stay fixed while low dynamic range and compression create an archived-internet finish.",
    image: "example-05",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `ccd-jpeg-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 61 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/ccd-jpeg-filter-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/ccd-jpeg-filter-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "ccd-jpeg-filter",
    name: "CCD JPEG Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const passportClickDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "dominican-passport",
    brand: "Viral document portrait",
    title: "The passport photo becomes the whole story",
    curatorNote: "A recognizable selfie becomes a neutral but unexpectedly photogenic government portrait inside a tightly cropped, worn passport.",
    image: "example-output",
  },
  {
    id: "brazilian-passport",
    brand: "Identity preservation",
    title: "Keep the face. Change the context.",
    curatorNote: "The same recipe preserves another identity while lamination, print texture, creases, and security detail make the document feel issued.",
    image: "example-02",
  },
  {
    id: "european-passport",
    brand: "Low-fi realism",
    title: "Let print damage sell the illusion",
    curatorNote: "Washed color, scanner softness, halftone texture, and paper wear prevent the attractive portrait from feeling like a studio photo.",
    image: "example-03",
  },
  {
    id: "georgia-passport",
    brand: "Repeatable portrait",
    title: "A new face still fits the same recipe",
    curatorNote: "Straight-on posture, tight document framing, and machine-readable detail repeat without turning the subject into somebody else.",
    image: "example-04",
  },
  {
    id: "jamaican-passport",
    brand: "Printed portrait",
    title: "Make the beauty feel government-issued",
    curatorNote: "A neutral expression stays photogenic beneath holograms, print dots, glare, slight warping, and convincing document wear.",
    image: "example-05",
  },
  {
    id: "united-states-passport",
    brand: "Social-media crop",
    title: "Crop aggressively enough to stop the scroll",
    curatorNote: "The passport extends beyond the frame while compression and handheld softness make the close-up feel casually screenshotted and reposted.",
    image: "example-06",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `passport-click-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 67 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/passport-click-v1/assets/source/${image}.jpg`,
    ...(index === 0
      ? {
          referenceSrc:
            "/format-repositories/passport-click-v1/assets/source/reference-input.jpg",
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "passport-click",
    name: "Passport Click",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const fakeItTillYouMakeItDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "yellow-pirelli-cap",
    brand: "Lifestyle transformation",
    title: "Make the mirror selfie look casually expensive",
    curatorNote: "Bright linen, embroidered headwear, jewelry, and flat daylight keep the hero polished without losing its phone-photo energy.",
    image: "yellow-pirelli-cap",
  },
  {
    id: "luxury-bathroom",
    brand: "Streetwear mirror selfie",
    title: "Layer the fit without losing the candid",
    curatorNote: "A raised drink, hooded color blocking, reflective tiles, and warm hotel light create a believable high-end night out.",
    image: "luxury-bathroom",
  },
  {
    id: "shooting-range",
    brand: "Action candid",
    title: "Freeze the moment downrange",
    curatorNote: "The stance, safety gear, target, lane number, and hard fluorescent light make the generated action feel observed rather than staged.",
    image: "shooting-range",
  },
  {
    id: "sheet-mask-mirror",
    brand: "Private mirror selfie",
    title: "Make the unbothered moment the post",
    curatorNote: "Wet hair, a crinkled hydrogel mask, dim stone, and a loose pose make the bathroom frame feel raw and personal.",
    image: "sheet-mask-mirror",
  },
  {
    id: "tropical-hat",
    brand: "Vacation selfie",
    title: "Point the camera straight into summer",
    curatorNote: "An extreme low angle, clean sky, mirrored lenses, and palm fronds deliver an unmistakable vacation flex.",
    image: "tropical-hat",
  },
  {
    id: "nyc-bench",
    brand: "Street-style duo",
    title: "Two iced coffees, zero effort",
    curatorNote: "Distinct outfits, deadpan expressions, dappled light, and a full-body street crop make the pairing feel editorial and spontaneous.",
    image: "nyc-bench",
  },
  {
    id: "concrete-cafe",
    brand: "Quiet café candid",
    title: "Let the morning light do the flexing",
    curatorNote: "Golden window light, worn leather, satin, and a reclined posture turn a raw concrete room into a calm lifestyle frame.",
    image: "concrete-cafe",
  },
  {
    id: "bed-mask",
    brand: "Raw close-up",
    title: "Post the morning exactly as it feels",
    curatorNote: "The overhead crop, creased mask, wired earbuds, tattoos, and warm side light keep the scene intimate and deliberately unpolished.",
    image: "bed-mask",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `fake-it-till-you-make-it-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 73 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/fake-it-till-you-make-it-v1/assets/source/${image}.jpg`,
    referenceSrc:
      "/format-repositories/fake-it-till-you-make-it-v1/assets/source/reference-input.jpg",
    durationLabel: "Static",
  },
  format: {
    slug: "fake-it-till-you-make-it",
    name: "Fake It Till You Make It",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const darkStudioPortraitDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "afro-glasses",
    brand: "Monochrome portrait",
    title: "Let the rim light draw the whole face",
    curatorNote: "A clean halo, deep facial shadow, crisp glasses, and heavy grain turn formal tailoring into a raw analog portrait.",
    image: "afro-glasses",
  },
  {
    id: "cover",
    brand: "Editorial cover",
    title: "Put the calm stare inside the darkness",
    curatorNote: "The off-center crop, formal black suit, and controlled falloff make a simple portrait feel immediately cinematic.",
    image: "cover",
  },
  {
    id: "soft-glasses",
    brand: "Soft-focus portrait",
    title: "Keep the edges imperfect",
    curatorNote: "A slight head tilt, faint bloom, and gentle softness keep the high-contrast studio treatment human.",
    image: "soft-glasses",
  },
  {
    id: "braided-rim",
    brand: "Hair-light study",
    title: "Trace every braid with light",
    curatorNote: "The overhead halo separates the braided silhouette while pores, grain, and deep eye shadows preserve realism.",
    image: "braided-rim",
  },
  {
    id: "wet-curls-glasses",
    brand: "Textured close-up",
    title: "Make every curl catch the backlight",
    curatorNote: "Wet curls, facial hair, and glasses retain their geometry even as the face recedes into crushed blacks.",
    image: "wet-curls-glasses",
  },
  {
    id: "shadow-fringe",
    brand: "Low-key silhouette",
    title: "Let the face almost disappear",
    curatorNote: "A bright fringe halo and barely visible expression show how little fill light the recipe needs.",
    image: "shadow-fringe",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `dark-studio-portrait-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 81 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/dark-studio-portrait-v1/assets/source/${image}.jpg`,
    referenceSrc:
      "/format-repositories/dark-studio-portrait-v1/assets/source/reference-input.jpg",
    durationLabel: "Static",
  },
  format: {
    slug: "dark-studio-portrait",
    name: "Dark Studio Portrait",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const bluePhosphorDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "car-headlights",
    brand: "Analog night portrait",
    title: "Make the headlights glow like the portrait",
    curatorNote: "The source face, jacket, car, and city remain intact while cyan bloom, scanlines, and interference rings reshape the mood.",
    image: "car-headlights",
  },
  {
    id: "terrace",
    brand: "City portrait",
    title: "Turn the whole skyline cyan",
    curatorNote: "A bright face, white shirt, dark jacket, and distant city keep their depth inside a luminous monochrome treatment.",
    image: "terrace",
  },
  {
    id: "neon-stage",
    brand: "Neon portrait",
    title: "Let red disappear into phosphor blue",
    curatorNote: "The stage architecture, tattoos, jewelry, and relaxed pose survive as face-centered rings travel through the scene.",
    image: "neon-stage",
  },
  {
    id: "night-car",
    brand: "Nightlife portrait",
    title: "Keep the original pose under the filter",
    curatorNote: "Vehicle lights bloom into cyan without changing the subject's stance, crop, clothing, or airport-night background.",
    image: "night-car",
  },
  {
    id: "cowboy-market",
    brand: "Street-style portrait",
    title: "Run scanlines through every detail",
    curatorNote: "The cowboy hat, jacket, store, and direct gaze stay legible under fine horizontal texture and soft phosphor halation.",
    image: "cowboy-market",
  },
  {
    id: "garage",
    brand: "Garage portrait",
    title: "Keep rich texture in the blue shadows",
    curatorNote: "Cap, clothing, stance, and industrial background stay recognizable while the grade pushes deep without crushing detail.",
    image: "garage",
  },
  {
    id: "lounge",
    brand: "Lounge portrait",
    title: "Make a busy room feel hypnotic",
    curatorNote: "The seated pose, drink, jewelry, and bar remain photographic as subtle optical rings organize the whole frame.",
    image: "lounge",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `blue-phosphor-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 88 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/blue-phosphor-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "blue-phosphor",
    name: "Blue Phosphor Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const duskEffectDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "mountain-hiker",
    brand: "Landscape transformation",
    title: "Turn daylight into a believable dusk",
    curatorNote: "The hiker, gear, rocks, and distant peaks stay recognizable while the overcast sky becomes a layered pink, lavender, and blue dusk.",
    image: "mountain-hiker",
    reference: "mountain-hiker-reference",
  },
  {
    id: "beach-path",
    brand: "Coastal transformation",
    title: "Keep the beach clear under a darker sky",
    curatorNote: "Dunes, fence, path, ocean, and bird keep their source composition as warm horizon light rolls into pink and blue.",
    image: "beach-path",
    reference: "beach-path-reference",
  },
  {
    id: "paddleboard",
    brand: "Outdoor transformation",
    title: "Change the hour without losing the action",
    curatorNote: "The swimmer, board, paddle, water, and shoreline stay intact beneath a sunless orange-to-deep-blue gradient.",
    image: "paddleboard",
    reference: "paddleboard-reference",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `dusk-effect-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 95 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/dusk-effect-v1/assets/source/${image}.jpg`,
    referenceSrc: `/format-repositories/dusk-effect-v1/assets/source/${reference}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "dusk-effect",
    name: "Dusk Effect",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const sparklingEffectDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "shoreline-bather",
    brand: "Coastal transformation",
    title: "Put sunlight back into the water",
    curatorNote: "The person, shoreline, horizon, and camera angle stay recognizable as tiny natural glints warm the whole scene.",
    image: "shoreline-bather",
    reference: "shoreline-bather-reference",
  },
  {
    id: "seashells",
    brand: "Detail transformation",
    title: "Make close details catch the light",
    curatorNote: "Hands, shells, jewelry, and crop remain intact while soft reflections and warmer film color add polish.",
    image: "seashells",
    reference: "seashells-reference",
  },
  {
    id: "ocean-texture",
    brand: "Texture study",
    title: "Turn existing highlights into crystal glints",
    curatorNote: "The original wave pattern stays untouched while diamond-like highlights follow the water's real contours.",
    image: "ocean-texture",
    reference: "ocean-texture-reference",
  },
  {
    id: "walking-beach",
    brand: "Golden-hour transformation",
    title: "Warm the hour without changing the moment",
    curatorNote: "The person, walking pose, clothing, sea, and horizon remain recognizable beneath believable sunset bloom.",
    image: "walking-beach",
    reference: "walking-beach-reference",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `sparkling-effect-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 99 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/sparkling-effect-v1/assets/source/${image}.jpg`,
    referenceSrc: `/format-repositories/sparkling-effect-v1/assets/source/${reference}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "sparkling-effect",
    name: "Sparkling Effect",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const coolToneFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "snow-duo",
    brand: "Night snapshot",
    title: "Make flash feel colder than the weather",
    curatorNote: "Both people, winter layers, hand gestures, and the snowy setting stay readable under bright compact-camera flash.",
    image: "snow-duo",
    reference: "snow-duo-reference",
  },
  {
    id: "reclining-portrait",
    brand: "Casual portrait",
    title: "Turn a polished pose into a Y2K snapshot",
    curatorNote: "The relaxed pose and location stay intact while mild overexposure and low-resolution texture make the frame feel casually captured.",
    image: "reclining-portrait",
    reference: "reclining-portrait-reference",
  },
  {
    id: "canal-portrait",
    brand: "Travel portrait",
    title: "Give blue hour a cheap-digital flash",
    curatorNote: "Cool ambient color, frontal flash, grain, and a corner timestamp turn a canal portrait into an era-specific memory.",
    image: "canal-portrait",
    reference: "canal-portrait-reference",
  },
  {
    id: "beach-couple",
    brand: "Couple portrait",
    title: "Keep the tenderness, add the timestamp",
    curatorNote: "Both identities and the affectionate pose survive while flash, slight blowout, and texture make the beach image feel candid.",
    image: "beach-couple",
    reference: "beach-couple-reference",
  },
  {
    id: "shutter-portrait",
    brand: "Low-light portrait",
    title: "Let low light stay a little imperfect",
    curatorNote: "The dark outfit and shuttered setting stay recognizable as cool flash and digital noise give the frame compact-camera character.",
    image: "shutter-portrait",
    reference: "shutter-portrait-reference",
  },
  {
    id: "london-candid",
    brand: "Travel candid",
    title: "Make the tourist photo feel found",
    curatorNote: "The person, gesture, river, and Big Ben remain clear under a cool, timestamped treatment that feels lifted from an old memory card.",
    image: "london-candid",
    reference: "london-candid-reference",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `cool-tone-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 103 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/cool-tone-filter-v1/assets/source/${image}-display.jpg`,
    referenceSrc: `/format-repositories/cool-tone-filter-v1/assets/source/${reference}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "cool-tone-filter",
    name: "Cool Tone Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const haloEffectDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "football-rim-glow",
    brand: "Studio portrait",
    title: "Make the edge light carry the whole frame",
    curatorNote: "The footballer, jersey, ball, and frontal pose stay recognizable while a bright halo cuts the subject out of pure black.",
    image: "football-rim-glow",
    reference: "football-rim-glow-reference",
  },
  {
    id: "alpine-portrait",
    brand: "Seated portrait",
    title: "Turn an outdoor pose into low-key studio drama",
    curatorNote: "The seated pose and technical outfit survive as a crisp rim light traces the hair, shoulders, and arms.",
    image: "alpine-portrait",
    reference: "alpine-portrait-reference",
  },
  {
    id: "mountain-sunglasses",
    brand: "Fashion portrait",
    title: "Let the silhouette stay recognizable",
    curatorNote: "Sunglasses, hair, knit texture, and the three-quarter pose remain readable inside a controlled semi-silhouette.",
    image: "mountain-sunglasses",
    reference: "mountain-sunglasses-reference",
  },
  {
    id: "sea-portrait",
    brand: "Body portrait",
    title: "Sculpt the shoulders with a clean halo",
    curatorNote: "The wet hair, crossed arms, and physique stay intact while the rim light creates strong separation.",
    image: "sea-portrait",
    reference: "sea-portrait-reference",
  },
  {
    id: "city-candid",
    brand: "Candid portrait",
    title: "Pull daylight into a black-box studio",
    curatorNote: "The loose shirt, shoulder bag, stance, and face carry through a dramatic black-background treatment.",
    image: "city-candid",
    reference: "city-candid-reference",
  },
  {
    id: "golf-silhouette",
    brand: "Full-body portrait",
    title: "Keep the full pose, lose the environment",
    curatorNote: "The cap, fitted black outfit, standing pose, and proportions remain recognizable inside a narrow rim-light outline.",
    image: "golf-silhouette",
    reference: "golf-silhouette-reference",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `halo-effect-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 109 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/halo-effect-v1/assets/source/${image}-display.jpg`,
    referenceSrc: `/format-repositories/halo-effect-v1/assets/source/${reference}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "halo-effect",
    name: "Halo Effect",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const doodleArtDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "neon-fashion",
    brand: "Fashion portrait",
    title: "Turn neon street style into a playful sketch",
    curatorNote: "The oversized pose, sunglasses, cap, and vivid palette survive as loose black brush lines and selective color.",
    image: "neon-fashion-doodle",
    reference: "neon-fashion-reference",
  },
  {
    id: "blue-glasses",
    brand: "Character portrait",
    title: "Let one accessory anchor the doodle",
    curatorNote: "The close crop, round blue glasses, hairstyle, and direct expression stay recognizable inside a deliberately simple drawing.",
    image: "blue-glasses-doodle",
    reference: "blue-glasses-reference",
  },
  {
    id: "star-sticker",
    brand: "Playful portrait",
    title: "Reduce the frame without losing the personality",
    curatorNote: "The face, hand gesture, blue star, and bright expression become a sparse, childlike illustration on white.",
    image: "star-sticker-doodle",
    reference: "star-sticker-reference",
  },
  {
    id: "couple",
    brand: "Couple portrait",
    title: "Keep two people readable with almost no detail",
    curatorNote: "The embrace, height relationship, dark outfits, and cheerful pose carry through the simplified linework.",
    image: "couple-doodle",
    reference: "couple-reference",
  },
  {
    id: "popsicle",
    brand: "Lifestyle portrait",
    title: "Make one candid prop the visual hook",
    curatorNote: "The close portrait, hand pose, frozen treat, and sunny mood become a compact black-ink character sketch.",
    image: "popsicle-doodle",
    reference: "popsicle-reference",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `doodle-art-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 115 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/doodle-art-v1/assets/source/${image}.jpg`,
    referenceSrc: `/format-repositories/doodle-art-v1/assets/source/${reference}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "doodle-art",
    name: "Doodle Art",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const lightSilhouetteDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "coastal-cliff",
    brand: "Coastal portrait",
    title: "Turn one quiet pose into a beacon",
    curatorNote: "The exact stance, loose clothing, bag, horizon, and coastline remain intact while only the subject becomes luminous.",
    image: "coastal-cliff",
  },
  {
    id: "desert-camel",
    brand: "Travel portrait",
    title: "Keep the animal and transform only the person",
    curatorNote: "The camel, reins, dunes, and stance stay photographic while the human subject becomes a warm white silhouette.",
    image: "desert-camel",
  },
  {
    id: "subway-platform",
    brand: "Urban portrait",
    title: "Make the subject glow inside a dark commute",
    curatorNote: "The folded arms, crossed-leg lean, pole, train, and platform perspective survive the high-contrast treatment.",
    image: "subway-platform",
  },
  {
    id: "misty-hills",
    brand: "Landscape portrait",
    title: "Hold a tiny figure inside a huge landscape",
    curatorNote: "A restrained glow keeps the distant subject visible without flattening the mist or layered green ridges.",
    image: "misty-hills",
  },
  {
    id: "pyramid-dance",
    brand: "Action portrait",
    title: "Preserve an impossible pose in full light",
    curatorNote: "Fine glow lines keep the airborne limbs readable while the pyramids and desert remain untouched.",
    image: "pyramid-dance",
  },
  {
    id: "mountain-meadow",
    brand: "Golden-hour portrait",
    title: "Let the existing sun drive the effect",
    curatorNote: "The outstretched arms, meadow, and mountain skyline stay fixed while the aura follows the original backlight.",
    image: "mountain-meadow",
  },
  {
    id: "lakeside-field",
    brand: "Nature portrait",
    title: "Balance a warm silhouette against a cool valley",
    curatorNote: "The standing subject stays legible across water and grass while every landscape layer preserves its photographic depth.",
    image: "lakeside-field",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `light-silhouette-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 120 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/light-silhouette-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "light-silhouette",
    name: "Light Silhouette",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const rimPortraitFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "wiggly-proof",
    brand: "Rim-light portrait",
    title: "Let one halo draw the whole portrait",
    curatorNote: "A verified fixture portrait keeps its distinctive face and hair while the clean backlight turns the frame into a sculptural silhouette.",
    image: "wiggly-proof",
    reference: "reference-input",
  },
  {
    id: "curly-halo",
    brand: "SKAI source example",
    title: "Let the curls carry the rim",
    curatorNote: "Dense curls hold a bright outline while the centered face remains readable inside deep shadow.",
    image: "skai-example-01",
  },
  {
    id: "braided-halo",
    brand: "SKAI source example",
    title: "Keep every braid legible",
    curatorNote: "Individual braids, shoulders, and jewelry stay distinct without weakening the silhouette.",
    image: "skai-example-02",
  },
  {
    id: "horse-hood",
    brand: "SKAI source example",
    title: "Make an unusual outline iconic",
    curatorNote: "The tall hood and white tank become a simple, memorable two-value composition.",
    image: "skai-example-03",
  },
  {
    id: "shearling-profile",
    brand: "SKAI source example",
    title: "Break symmetry without losing the light",
    curatorNote: "A three-quarter profile, loose locs, and tactile collar prove the recipe can flex beyond a straight-on pose.",
    image: "skai-example-04",
  },
  {
    id: "cowboy-halo",
    brand: "SKAI source example",
    title: "Use the hat as the outline",
    curatorNote: "The brim holds a clean graphic shape while a narrow rim separates the curls from white.",
    image: "skai-example-05",
  },
  {
    id: "hooded-halo",
    brand: "SKAI source example",
    title: "Hold detail inside the darkness",
    curatorNote: "The hood, hair, and sunglasses remain barely visible without adding excess fill light.",
    image: "skai-example-06",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `rim-portrait-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 127 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/rim-portrait-filter-v1/assets/source/${image}.jpg`,
    ...(reference
      ? {
          referenceSrc:
            `/format-repositories/rim-portrait-filter-v1/assets/source/${reference}.jpg`,
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "rim-portrait-filter",
    name: "Rim Portrait Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const cyanotypeDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "wiggly-proof",
    brand: "Handcrafted cyanotype",
    title: "Make the chemistry feel real",
    curatorNote: "A verified fixture portrait keeps its identity and clothing while watercolor paper, uneven exposure, and Prussian blue make the result feel physically printed.",
    image: "wiggly-proof",
    reference: "reference-input",
  },
  {
    id: "skull-portrait",
    brand: "SKAI source example",
    title: "Layer the skull without losing the face",
    curatorNote: "Sunglasses, chain, face, and hair remain legible beneath a translucent photographic skull exposure.",
    image: "skai-example-01",
  },
  {
    id: "woman-and-dog",
    brand: "SKAI source example",
    title: "Keep two personalities in one print",
    curatorNote: "The woman, dog, porch, and plants hold their depth while the skeletal layer stays restrained.",
    image: "skai-example-02",
  },
  {
    id: "costume-embrace",
    brand: "SKAI source example",
    title: "Preserve texture through a surreal embrace",
    curatorNote: "Fur, fabric, faces, and an unusual pose stay distinct inside one tactile blue exposure.",
    image: "skai-example-03",
  },
  {
    id: "beach-skeleton",
    brand: "SKAI source example",
    title: "Turn a snapshot into an exposure study",
    curatorNote: "The person, sunglasses, shoreline, and horizon survive while the torso skeleton blends into the body.",
    image: "skai-example-04",
  },
  {
    id: "cat-portrait",
    brand: "SKAI source example",
    title: "Make animal anatomy feel delicate",
    curatorNote: "Fine whiskers, hair, jacket texture, and a faint skeleton feel artistic rather than clinical.",
    image: "skai-example-05",
  },
  {
    id: "boxer-skeleton",
    brand: "SKAI source example",
    title: "Use anatomy to amplify motion",
    curatorNote: "Gloves, trunks, stance, and arena remain intact while the moving body earns the strongest X-ray reveal.",
    image: "skai-example-06",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `cyanotype-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 134 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/cyanotype-v1/assets/source/${image}.jpg`,
    ...(reference
      ? {
          referenceSrc:
            `/format-repositories/cyanotype-v1/assets/source/${reference}.jpg`,
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "cyanotype",
    name: "Cyanotype",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const lordOfTheRingsDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Cinematic fantasy grade",
    title: "Turn an ordinary greenhouse into an epic sunrise",
    curatorNote: "The native SKAI cover shows the real before and after together: same person, same greenhouse, same framing, with only light, atmosphere, color, and detail transformed.",
    image: "skai-hero",
  },
  {
    id: "wiggly-proof",
    brand: "Wiggly proof",
    title: "Keep the whole conservatory while changing the hour",
    curatorNote: "A separate fixture proves the traveler, pose, path, rocks, plants, and glass structure survive the cinematic sunrise grade.",
    image: "wiggly-proof",
    reference: "reference-input",
  },
  {
    id: "waterfall-conservatory",
    brand: "SKAI source example",
    title: "Turn glasshouse water into a hidden valley",
    curatorNote: "The waterfall, pool, roof, and planting stay photographic while warm rays add depth through the foliage.",
    image: "skai-example-01",
  },
  {
    id: "moss-garden",
    brand: "SKAI source example",
    title: "Let a quiet garden feel mythic",
    curatorNote: "The lantern, bridge, koi pond, and clipped shrubs stay intact beneath restrained mist and sunrise light.",
    image: "skai-example-02",
  },
  {
    id: "forest-path",
    brand: "SKAI source example",
    title: "Make the path invite an adventure",
    curatorNote: "God rays reveal depth through the existing foliage while clean blues and deep greens avoid an orange cast.",
    image: "skai-example-03",
  },
  {
    id: "glasshouse-garden",
    brand: "SKAI source example",
    title: "Keep every flower while changing the hour",
    curatorNote: "The glasshouse, path, hydrangeas, and beds retain their arrangement while low sunlight expands the dynamic range.",
    image: "skai-example-04",
  },
  {
    id: "stepping-stone-walk",
    brand: "SKAI source example",
    title: "Carry a real person through the atmosphere",
    curatorNote: "The person, clothing, pond, stones, and garden remain recognizable beneath subtle light and haze.",
    image: "skai-example-05",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `lord-of-the-rings-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 141 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/lord-of-the-rings-v1/assets/source/${image}.jpg`,
    ...(reference
      ? {
          referenceSrc:
            `/format-repositories/lord-of-the-rings-v1/assets/source/${reference}.jpg`,
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "lord-of-the-rings",
    name: "Lord of the Rings",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const softGlowFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Soft cinematic filter",
    title: "Make an outdoor memory feel worth saving",
    curatorNote: "The native SKAI cover makes the recipe instantly legible: a realistic mountain portrait, soft film texture, and restrained handwritten notes.",
    image: "skai-hero",
    reference: "reference-input",
  },
  {
    id: "mountain-seat",
    brand: "SKAI source example",
    title: "Turn a summit photo into a saved memory",
    curatorNote: "The same hiker, pose, clothing, and mountain stay recognizable beneath soft glow, grain, and three short captions.",
    image: "skai-example-01",
  },
  {
    id: "ridge-overlook",
    brand: "SKAI source example",
    title: "Let a wide landscape keep its scale",
    curatorNote: "Muted film texture and sparse handwriting add mood without replacing the ridge or shrinking the scene.",
    image: "skai-example-02",
  },
  {
    id: "summit-rest",
    brand: "SKAI source example",
    title: "Keep the playful pose inside the treatment",
    curatorNote: "Both people and the open mountain background survive while gentle blur and captions turn the photo into an archive frame.",
    image: "skai-example-03",
  },
  {
    id: "motorbike-road",
    brand: "SKAI source example",
    title: "Make a group ride feel archival",
    curatorNote: "The riders, bikes, road, and mountain geometry remain intact beneath one coherent memory-dump finish.",
    image: "skai-example-04",
  },
  {
    id: "forest-rock",
    brand: "SKAI source example",
    title: "Give a quiet forest stop a gentle glow",
    curatorNote: "Subdued greens, fine grain, and two restrained notes support the original wooded portrait.",
    image: "skai-example-05",
  },
  {
    id: "creek-log",
    brand: "SKAI source example",
    title: "Keep texture alive in a darker scene",
    curatorNote: "The person, log, creek, and foliage stay legible while pale captions hold up against the busier background.",
    image: "skai-example-06",
  },
].map(({ image, reference, ...proof }, index) => ({
  ...proof,
  id: `soft-glow-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 148 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/soft-glow-filter-v1/assets/source/${image}.jpg`,
    ...(reference
      ? {
          referenceSrc:
            `/format-repositories/soft-glow-filter-v1/assets/source/${reference}.jpg`,
        }
      : {}),
    durationLabel: "Static",
  },
  format: {
    slug: "soft-glow-filter",
    name: "Soft Glow Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const paperOutfitDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Fashion transformation",
    title: "Turn the outfit into a handmade collage",
    curatorNote: "The native SKAI cover makes the recipe instantly legible: a real street portrait, tactile paper clothing, and one original-photo inset.",
    image: "skai-hero",
  },
  {
    id: "amalfi-balcony",
    brand: "SKAI source example",
    title: "Keep a sunny travel portrait completely real",
    curatorNote: "The person, pose, terrace, and sea remain photographic while the outfit and accessories become layered paper drawings.",
    image: "skai-example-01",
  },
  {
    id: "coastal-terrace",
    brand: "SKAI source example",
    title: "Let the background keep every detail",
    curatorNote: "Face, hair, architecture, and coast stay intact while the gingham top, skirt, and shoes share one handmade treatment.",
    image: "skai-example-02",
  },
  {
    id: "ice-cream-street",
    brand: "SKAI source example",
    title: "Carry the effect across a full outfit",
    curatorNote: "Top, shorts, and bag gain pencil texture and cut edges without changing the subject, ice cream, car, or street.",
    image: "skai-example-03",
  },
  {
    id: "front-step",
    brand: "SKAI source example",
    title: "Make layered separates feel handmade",
    curatorNote: "Distinct paper colors and white cut edges transform only the clothes while the doorway portrait stays photographic.",
    image: "skai-example-04",
  },
  {
    id: "resort-wall",
    brand: "SKAI source example",
    title: "Preserve the candid pose beneath the craft",
    curatorNote: "Each garment becomes a paper object aligned to the original body while the face, skin, wall, plants, and light stay real.",
    image: "skai-example-05",
  },
  {
    id: "museum-hall",
    brand: "SKAI source example",
    title: "Keep dramatic architecture outside the edit",
    curatorNote: "The hall and portrait remain photographic while the dress gains visible paper texture, hand-drawn pigment, and crisp cut edges.",
    image: "skai-example-06",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `paper-outfit-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 155 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/paper-outfit-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "paper-outfit",
    name: "Paper Outfit",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const moodyPinkEffectDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Nightlife transformation",
    title: "Turn nightlife into a luxury pink editorial",
    curatorNote: "The native SKAI cover makes the recipe immediate: a preserved city portrait, polished pink atmosphere, and one original-photo inset.",
    image: "skai-hero",
  },
  {
    id: "bar-reaction",
    brand: "SKAI source example",
    title: "Keep every spontaneous reaction readable",
    curatorNote: "Three faces, hand gestures, drinks, and a crowded bar remain clear while integrated magenta light reshapes the mood.",
    image: "skai-example-01",
  },
  {
    id: "late-night-drinks",
    brand: "SKAI source example",
    title: "Carry pink light through a crowded frame",
    curatorNote: "People, clothing, glassware, and the venue keep their structure beneath rich shadows and a premium nightlife grade.",
    image: "skai-example-02",
  },
  {
    id: "quiet-booth",
    brand: "SKAI source example",
    title: "Make a quiet portrait deliberately cinematic",
    curatorNote: "The face, hand, cigarette, booth, and tiled wall stay recognizable while the practical light motivates the pink atmosphere.",
    image: "skai-example-03",
  },
  {
    id: "group-snapshot",
    brand: "SKAI source example",
    title: "Preserve every face in a candid group photo",
    curatorNote: "The people and expressions remain photographic as soft contrast and magenta ambient light unify the busy snapshot.",
    image: "skai-example-04",
  },
  {
    id: "pink-shoreline",
    brand: "SKAI source example",
    title: "Move the same palette into open air",
    curatorNote: "Both people, the shoreline, water, and horizon retain depth under an elegant pink dusk treatment.",
    image: "skai-example-05",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `moody-pink-effect-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 162 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/moody-pink-effect-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "moody-pink-effect",
    name: "Moody Pink Effect",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const cinematicPortraitPackDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Eight-look portrait pack",
    title: "Turn one portrait into eight cinematic worlds",
    curatorNote: "SKAI's native cover makes the range immediate: mirror flash, punk noir, car editorial, and cinematic night scenes all belong to one reusable portrait pack.",
    image: "skai-carousel-01",
  },
  {
    id: "mirror-selfie",
    brand: "SKAI source example",
    title: "Make a mirror selfie feel like a film still",
    curatorNote: "The source face survives moody indoor light, damp hair, cigarette smoke, glasses, skin texture, and a convincingly casual phone-photo finish.",
    image: "skai-carousel-02",
  },
  {
    id: "rain-mask",
    brand: "SKAI source example",
    title: "Catch the mask reveal in heavy rain",
    curatorNote: "Wet fabric, tears, rain streaks, cool moonlight, and a partially lifted mask turn one close-up into a readable cinematic action.",
    image: "skai-carousel-03",
  },
  {
    id: "car-editorial",
    brand: "SKAI source example",
    title: "Build a quiet fashion frame around the car",
    curatorNote: "The low seated pose, oversized tailoring, open door, wild grass, and bright negative space hold one restrained editorial mood.",
    image: "skai-carousel-04",
  },
  {
    id: "punk-noir",
    brand: "SKAI source example",
    title: "Push a close-up into hard punk noir",
    curatorNote: "The eye-framing gesture, rings, pearls, high-contrast monochrome, and heavy film grain stay tactile without losing the subject.",
    image: "skai-carousel-05",
  },
  {
    id: "art-stop-sign",
    brand: "SKAI source example",
    title: "Let one flash-lit sign own the frame",
    curatorNote: "A low angle, navy night sky, direct flash, relaxed shoulder lean, and spray-painted ART mark create a clean street-editorial poster.",
    image: "skai-carousel-06",
  },
  {
    id: "sunroof-flash",
    brand: "SKAI source example",
    title: "Look down through the sunroof",
    curatorNote: "Two figures, the roof opening, leather interior, teal ambient light, and direct flash line up in one believable overhead photograph.",
    image: "skai-carousel-07",
  },
  {
    id: "sword-studio",
    brand: "SKAI source example",
    title: "Hold a supernatural pose inside a real studio",
    curatorNote: "A resilient kneeling posture, dragon tattoo, clean sword alignment, wet skin, and focused spotlight create drama without gore.",
    image: "skai-carousel-08",
  },
  {
    id: "cow-herd-sports-car",
    brand: "SKAI source example",
    title: "Put luxury in the middle of rural chaos",
    curatorNote: "The subject, reflective sports car, dense herd, forest road, and quiet daylight stay detailed inside one surreal editorial frame.",
    image: "skai-carousel-09",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `cinematic-portrait-pack-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 168 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/cinematic-portrait-pack-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "cinematic-portrait-pack",
    name: "Cinematic Portrait Pack",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const dreamcoreAngelDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Dreamcore transformation",
    title: "Become a fallen angel from a damaged tape",
    curatorNote: "SKAI's native cover makes the recipe immediate: a lowered face, enormous white wings, crushed blacks, blown highlights, and dirty monochrome grain.",
    image: "skai-carousel-01",
  },
  {
    id: "street-selfie",
    brand: "SKAI source example",
    title: "Let the wings consume the frame",
    curatorNote: "The same face survives inside a fragile lowered pose while luminous feathers push far beyond the body into black negative space.",
    image: "skai-carousel-02",
  },
  {
    id: "clean-portrait",
    brand: "SKAI source example",
    title: "Keep identity beneath crushed blacks",
    curatorNote: "A clean input portrait becomes a darker side-profile still without losing the recognizable eyes, nose, mouth, or overall identity.",
    image: "skai-carousel-03",
  },
  {
    id: "soft-features",
    brand: "SKAI source example",
    title: "Turn soft features into a gothic still",
    curatorNote: "Wing light wraps around the face while tape scratches, soft focus, and uneven exposure keep the image eerie and intimate.",
    image: "skai-carousel-04",
  },
  {
    id: "white-tee",
    brand: "SKAI source example",
    title: "Push bloom until it feels haunted",
    curatorNote: "A white shirt and recognizable face remain legible even as one wing blows through the shoulder and floods the lens with light.",
    image: "skai-carousel-05",
  },
  {
    id: "sports-selfie",
    brand: "SKAI source example",
    title: "Let feather light overpower the lens",
    curatorNote: "Both wings extend beyond the body while extreme bloom and sensor grain turn an everyday selfie into a low-fidelity music-video still.",
    image: "skai-carousel-06",
  },
  {
    id: "set-selfie",
    brand: "SKAI source example",
    title: "Hold the face inside a damaged tape",
    curatorNote: "The compact face-and-shoulders composition stays readable beneath horizontal interference, deep blacks, soft focus, and overexposed wings.",
    image: "skai-carousel-07",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `dreamcore-angel-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 177 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/dreamcore-angel-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "dreamcore-angel",
    name: "Dreamcore Angel",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const darkAestheticFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Dark aesthetic transformation",
    title: "Make the visual recipe clear in one glance",
    curatorNote: "SKAI's native cover establishes the aggressive contrast, hard directional light, luxury jewelry speculars, and dark editorial finish.",
    image: "skai-carousel-01",
  },
  {
    id: "bath-cash",
    brand: "SKAI source example",
    title: "Make jewelry own the light",
    curatorNote: "A single baked source inset proves the person survives while cash, chains, skin, and shadows take on controlled hard light.",
    image: "skai-carousel-02",
  },
  {
    id: "cash-stack",
    brand: "SKAI source example",
    title: "Keep the pose, push the contrast",
    curatorNote: "The familiar pose and outfit remain intact as crushed blacks and metal highlights turn the frame into an editorial portrait.",
    image: "skai-carousel-03",
  },
  {
    id: "car-door",
    brand: "SKAI source example",
    title: "Turn a street shot into a magazine spread",
    curatorNote: "Directional light isolates the same street subject and holds enough texture to feel remastered rather than covered by a filter.",
    image: "skai-carousel-04",
  },
  {
    id: "hood-script",
    brand: "SKAI source example",
    title: "Make ink and chains cut through black",
    curatorNote: "Jewelry, tattoo detail, fabric, and the recognizable hoodie remain sharp inside a much darker composition.",
    image: "skai-carousel-05",
  },
  {
    id: "eyes-closed",
    brand: "SKAI source example",
    title: "Let diamonds carry the frame",
    curatorNote: "The source pose stays readable while hard reflections and a dark falloff focus attention on jewelry and skin.",
    image: "skai-carousel-06",
  },
  {
    id: "leopard-wall",
    brand: "SKAI source example",
    title: "Hold skin and leather against texture",
    curatorNote: "Cool shadows and tactile fabric detail make the aggressive grade feel photographic instead of generic.",
    image: "skai-carousel-07",
  },
  {
    id: "sunglasses",
    brand: "SKAI source example",
    title: "Use hard light like a spotlight",
    curatorNote: "Sharp but believable reflections transform a simple portrait without replacing its identity or pose.",
    image: "skai-carousel-08",
  },
  {
    id: "concrete-step",
    brand: "SKAI source example",
    title: "Keep the street pose, rebuild the mood",
    curatorNote: "The seated pose remains recognizable as deep falloff, grain, and cool shadows rebuild the mood around it.",
    image: "skai-carousel-09",
  },
  {
    id: "graffiti-prayer",
    brand: "SKAI source example",
    title: "Crush the blacks without losing detail",
    curatorNote: "Hands, clothes, and background remain readable in shadow—the contrast is intentional rather than a black overlay.",
    image: "skai-carousel-10",
  },
  {
    id: "studio-smile",
    brand: "SKAI source example",
    title: "Make joy survive the dark grade",
    curatorNote: "Hard studio light gives the same smiling subject a premium sheen without plastic skin or cosmetic smoothing.",
    image: "skai-carousel-11",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `dark-aesthetic-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 184 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/dark-aesthetic-filter-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "dark-aesthetic-filter",
    name: "Dark Aesthetic Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const twoThousandsEffectDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "2000s digicam transformation",
    title: "Make the visual recipe clear in one glance",
    curatorNote: "SKAI's native cover establishes the direct flash, noisy CCD softness, and candid early-digital camera finish.",
    image: "slide-01",
  },
  {
    id: "dinner",
    brand: "SKAI source example",
    title: "Make flash turn a dinner into a memory",
    curatorNote: "A baked source inset proves the same dinner scene survives under hot flash, low dynamic range, and camera shake.",
    image: "slide-02",
  },
  {
    id: "ocean",
    brand: "SKAI source example",
    title: "Let the light wash the frame",
    curatorNote: "The people and ocean-side pose remain visible while blown whites, bloom, and softness make the image feel found on an old memory card.",
    image: "slide-03",
  },
  {
    id: "subway",
    brand: "SKAI source example",
    title: "Give a subway snapshot real CCD character",
    curatorNote: "Direct flash, dated color, and imperfect focus transform the same close subway moment without replacing its people or setting.",
    image: "slide-04",
  },
  {
    id: "night-out",
    brand: "SKAI source example",
    title: "Turn a night out into a memory-card find",
    curatorNote: "The source group, sunglasses, and pose stay readable as highlight bloom and noise keep the scene raw rather than polished.",
    image: "slide-05",
  },
  {
    id: "convertible",
    brand: "SKAI source example",
    title: "Make a convertible feel caught on a cheap flash",
    curatorNote: "Harsh flash, edge softness, and inaccurate color age the same car portrait without changing its subject or composition.",
    image: "slide-06",
  },
  {
    id: "mirror",
    brand: "SKAI source example",
    title: "Let a mirror selfie keep its flaws",
    curatorNote: "The original reflection is preserved while uneven white balance, bloom, and noise strip away modern-phone polish.",
    image: "slide-07",
  },
  {
    id: "dog",
    brand: "SKAI source example",
    title: "Make a pet portrait feel instantly older",
    curatorNote: "Direct flash and imperfect autofocus turn the same person-and-dog moment into an authentic candid snapshot.",
    image: "slide-08",
  },
  {
    id: "crowd",
    brand: "SKAI source example",
    title: "Keep the flash hot and the moment messy",
    curatorNote: "The original friends and crowd stay recognizable under blown highlights, warmth, compression texture, and low-end camera imperfection.",
    image: "slide-09",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `2000s-effect-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 195 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/2000s-effect-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "2000s-effect",
    name: "2000s Effect",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const eightiesToonDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "native-hero",
    brand: "Retro cartoon transformation",
    title: "Make the transformation obvious in one glance",
    curatorNote: "SKAI's native cover shows the finished 80s Toon treatment beside the exact original gaming photo.",
    image: "slide-01",
  },
  {
    id: "stone-steps",
    brand: "SKAI source example",
    title: "Keep the face, ink, and relaxed pose",
    curatorNote: "The face, mustache, cap, tattoos, seated posture, and stone setting survive the bold retro linework.",
    image: "slide-02",
  },
  {
    id: "beach-toast",
    brand: "SKAI source example",
    title: "Carry a beach snapshot into animation",
    curatorNote: "The hat, braids, drink, gesture, outfit, and beach remain intact under flat color and classic cartoon eyes.",
    image: "slide-03",
  },
  {
    id: "tram",
    brand: "SKAI source example",
    title: "Preserve a full-body travel moment",
    curatorNote: "The yellow top, glasses, bag, pose, and tram interior all stay recognizable in clean geometric linework.",
    image: "slide-04",
  },
  {
    id: "fruit-market",
    brand: "SKAI source example",
    title: "Turn a colorful market into a cartoon set",
    curatorNote: "The expression, outfit, bag, fruit displays, and dense market scene remain legible after the style change.",
    image: "slide-05",
  },
  {
    id: "mirror-selfie",
    brand: "SKAI source example",
    title: "Keep a mirror selfie unmistakably personal",
    curatorNote: "The layered red outfit, phone pose, tattoos, silhouette, and room survive simple cel shading.",
    image: "slide-06",
  },
  {
    id: "car-bouquet",
    brand: "SKAI source example",
    title: "Hold onto the gesture and bouquet",
    curatorNote: "The hand-to-forehead gesture, flowers, lace top, face, and car seat remain recognizable.",
    image: "slide-07",
  },
  {
    id: "flower-market",
    brand: "SKAI source example",
    title: "Let the flowers carry the frame",
    curatorNote: "The striped shirt, bouquet, seated pose, and street setting stay intact under the playful vintage treatment.",
    image: "slide-08",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `80s-toon-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 204 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/80s-toon-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "80s-toon",
    name: "80s Toon",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

const fortniteFilterDiscoveryEntries: DiscoveryEntry[] = [
  {
    id: "rio-overlook",
    brand: "Portrait transformation",
    title: "From real portrait to game character",
    curatorNote: "The face, folded-arm pose, Brazil shirt, and Rio overlook survive the cinematic 3D transformation.",
    image: "skai-example-output",
  },
  {
    id: "banana-grove",
    brand: "Environment transformation",
    title: "Carry the whole setting into the game world",
    curatorNote: "The subject, goose, banana leaves, warm light, and playful gesture stay readable in one stylized scene.",
    image: "example-02",
  },
  {
    id: "pizza-street",
    brand: "Everyday action",
    title: "Keep the action, outfit, and location",
    curatorNote: "A pizza box, layered streetwear, tattoos, and the city backdrop all survive without losing the subject.",
    image: "example-03",
  },
  {
    id: "stadium",
    brand: "Full-body transformation",
    title: "Turn fan energy into a game-character frame",
    curatorNote: "The raised arms, Brazil outfit, stadium crowd, and long silhouette stay intact from head to toe.",
    image: "example-04",
  },
  {
    id: "cafe-duo",
    brand: "Two-person transformation",
    title: "Keep two people inside one coherent scene",
    curatorNote: "Both faces, the table pose, drinks, clothing, and cafe setting carry through the same polished 3D language.",
    image: "example-05",
  },
  {
    id: "puppy",
    brand: "Quiet character moment",
    title: "Small details still make it through",
    curatorNote: "The puppy, tracksuit, seated posture, expression, and soft home setting all remain recognizable.",
    image: "example-06",
  },
  {
    id: "safari",
    brand: "Travel transformation",
    title: "Make a travel portrait feel playable",
    curatorNote: "The subject, open-arm pose, elephants, foliage, and bright daylight become one believable game-world scene.",
    image: "example-07",
  },
  {
    id: "city-bench",
    brand: "Fashion transformation",
    title: "Hold onto the full fashion silhouette",
    curatorNote: "The seated pose, layered outfit, sneakers, cap, and city bench retain their shape through the stylization.",
    image: "example-08",
  },
].map(({ image, ...proof }, index) => ({
  ...proof,
  id: `fortnite-filter-${proof.id}`,
  status: "published",
  showInDiscovery: index === 0,
  order: 14 + index,
  goal: "entertain",
  media: {
    kind: "image",
    src: `/format-repositories/fortnite-filter-v1/assets/source/${image}.jpg`,
    durationLabel: "Static",
  },
  format: {
    slug: "fortnite-filter",
    name: "Fortnite Filter",
    version: "1.0.0",
    owner: "Wiggly Studio",
  },
}));

export const discoveryCatalog: DiscoveryEntry[] = [
  {
    id: "talking-fish-news-mars-tiles",
    status: "published",
    order: 5.25,
    brand: "NASA",
    title: "Mars enters its floor-tile era",
    curatorNote: "A real Mars discovery becomes a four-beat deadpan report without inventing the evidence or rebuilding the anchor.",
    goal: "entertain",
    media: {
      kind: "video",
      src: "/format-repositories/talking-fish-news-v1/goldens/nasa-curiosity.mp4",
      poster: "/format-repositories/talking-fish-news-v1/goldens/nasa-curiosity-poster.jpg",
      durationLabel: "19 sec",
    },
    format: {
      slug: "talking-fish-news",
      name: "Wiggly Talking Fish News",
      version: "1.0.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "final-straw-pocket-problem",
    status: "published",
    order: 1,
    brand: "FinalStraw",
    title: "The straw that fits in your pocket",
    curatorNote: "A familiar object becomes surprising when the mechanism is made visible.",
    goal: "sell",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/goldens/finalstraw.mp4",
      poster: "/discovery/final-straw.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "gruns-daily-stack",
    status: "published",
    order: 2,
    brand: "Grüns",
    title: "The daily stack, compressed",
    curatorNote: "The ad turns an invisible product promise into a physical journey.",
    goal: "explain",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/goldens/gruns.mp4",
      poster: "/discovery/gruns.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "theragun-heat-and-motion",
    status: "published",
    order: 3,
    brand: "Therabody",
    title: "Why heat changes the massage",
    curatorNote: "Two product benefits become one visual mechanism instead of a feature list.",
    goal: "explain",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/goldens/theragun.mp4",
      poster: "/discovery/theragun.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "kiala-supplement-journey",
    status: "published",
    order: 4,
    brand: "Kiala Nutrition",
    title: "The supplement journey",
    curatorNote: "The hidden delivery problem gives the product claim a visible reason.",
    goal: "explain",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/goldens/kiala.mp4",
      poster: "/discovery/kiala.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "lego-origin-story",
    status: "published",
    order: 5,
    brand: "LEGO",
    title: "How a wooden toy became a world",
    curatorNote: "A brand origin becomes a physical transformation instead of a timeline lecture.",
    goal: "story",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/agent-runs/lego-origin-world-arc-proof/final.mp4",
      poster: "/discovery/lego-origin.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "scrub-daddy-two-personalities",
    status: "published",
    order: 5.5,
    brand: "Scrub Daddy",
    title: "The sponge with two personalities",
    curatorNote: "Temperature becomes a visible personality switch between tough scrubbing and gentle flexibility.",
    goal: "explain",
    media: {
      kind: "video",
      src: "/format-repositories/three-d-breakdown-v1/agent-runs/scrub-daddy-day-6-character-locked-revision/final.mp4",
      poster: "/discovery/scrub-daddy.jpg",
      durationLabel: "20 sec",
    },
    format: {
      slug: "three-d-breakdown",
      name: "3D Breakdown",
      version: "1.5.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "wiggly-prompt-vs-format",
    status: "published",
    order: 5.5,
    brand: "Wiggly",
    title: "Prompt vs. Format",
    curatorNote: "Three quick comparisons make the difference between a one-off AI output and a reusable creative system easy to see.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/mugsy-explains-v1/goldens/wiggly-format-explainer.mp4",
      poster: "/format-repositories/mugsy-explains-v1/goldens/wiggly-format-explainer-poster.jpg",
      durationLabel: "25 sec",
    },
    format: {
      slug: "mugsy-explains",
      name: "Mugsy Explains",
      version: "0.1.1-proof",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "naruto-compilers",
    status: "published",
    order: 6,
    brand: "Developer Education",
    title: "Compilers, explained by Naruto",
    curatorNote: "Familiar characters carry a technical idea before the jargon arrives.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/naruto-compilers.mp4",
      poster: "/discovery/naruto-compilers.jpg",
      durationLabel: "75 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "naruto-mcp",
    status: "published",
    order: 7,
    brand: "Developer Tools",
    title: "MCP, explained by Naruto",
    curatorNote: "The visible roles make an unfamiliar agent protocol easier to remember.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/naruto-mcp.mp4",
      poster: "/discovery/naruto-mcp.jpg",
      durationLabel: "63 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "yugioh-compilers",
    status: "published",
    order: 8,
    brand: "Developer Education",
    title: "Compilers, explained by Yu-Gi-Oh!",
    curatorNote: "A second story world proves the lesson structure travels without changing the Format.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/yugioh-compilers.mp4",
      poster: "/discovery/yugioh-compilers.jpg",
      durationLabel: "64 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "danny-phantom-apis",
    status: "published",
    order: 9,
    brand: "Developer Education",
    title: "APIs, explained by Danny Phantom",
    curatorNote: "A ghost portal turns an invisible software handoff into a story people can follow.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/danny-apis.mp4",
      poster: "/discovery/danny-apis.jpg",
      durationLabel: "70 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "naruto-apis",
    status: "published",
    order: 10,
    brand: "Developer Education",
    title: "APIs, explained by Naruto",
    curatorNote: "A familiar mission makes software requests and responses easy to remember.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/naruto-apis.mp4",
      poster: "/discovery/naruto-apis.jpg",
      durationLabel: "68 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "spongebob-evs",
    status: "published",
    order: 11,
    brand: "Consumer Education",
    title: "Electric vehicles, explained by SpongeBob",
    curatorNote: "A playful world carries the comparison without turning it into a lecture.",
    goal: "teach",
    media: {
      kind: "video",
      src: "/format-repositories/otaku-explainer-v1/outputs/spongebob-evs.mp4",
      poster: "/discovery/spongebob-evs.jpg",
      durationLabel: "62 sec",
    },
    format: {
      slug: "otaku-explainer",
      name: "Cartoon Explainer",
      version: "1.2.1-experiment",
      owner: "Shaz",
    },
  },
  {
    id: "squilliam-news-artistic-emergency",
    status: "published",
    order: 11.5,
    brand: "We The Artists",
    title: "Squilliam declares an artistic emergency",
    curatorNote: "Choose Squilliam, Squidward, SpongeBob, or Mr. Krabs to turn a real promotion into a thirty-second bulletin with presenter-driven body language and a sharp sign-off.",
    goal: "story",
    media: {
      kind: "video",
      src: "/format-repositories/squilliam-news-v1/examples/we-the-artists/evidence/final.mp4",
      poster: "/format-repositories/squilliam-news-v1/examples/we-the-artists/evidence/poster.png",
      durationLabel: "30 sec",
      aspectRatio: "16:9",
    },
    format: {
      slug: "squilliam-news",
      name: "Squilliam News",
      version: "0.2.1-proof",
      owner: "Shaz",
    },
  },
  {
    id: "davids-cookies-this-is-fine",
    status: "published",
    order: 12,
    brand: "David's Cookies",
    title: "The birthday is tomorrow",
    curatorNote: "A familiar panic becomes a simple reason to send cookies now.",
    goal: "entertain",
    media: {
      kind: "image",
      src: "/discovery/meme/davids-cookies-this-is-fine.png",
      durationLabel: "Static",
    },
    format: {
      slug: "meme",
      name: "Meme",
      version: "1.0.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "hybrid-news-founder-moment",
    status: "published",
    order: 13,
    brand: "Founder-led",
    title: "Turn the announcement into the ad",
    curatorNote: "One real event becomes a clear story with a strong visual hierarchy.",
    goal: "story",
    media: {
      kind: "image",
      src: "/maker-fixtures/hybrid-news/reference.png",
      durationLabel: "Static",
    },
    format: {
      slug: "hybrid-news",
      name: "Hybrid News",
      version: "1.0.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "newsletter-writer-holden-history",
    status: "published",
    order: 13.5,
    brand: "Newsletter Writer",
    title: "Your brand voice, ready to write",
    curatorNote:
      "Give it a topic and real company proof. It writes a clear newsletter that sounds like your brand.",
    goal: "story",
    media: {
      kind: "image",
      src: "/discovery/newsletter-writer/newsletter-writer-agent.jpg",
      durationLabel: "Writing agent",
    },
    format: {
      slug: "newsletter-writer",
      name: "Newsletter Writer",
      version: "1.1.1",
      owner: "Wiggly Studio",
    },
  },
  ...fortniteFilterDiscoveryEntries,
  {
    id: "cinematic-photographer-source",
    status: "published",
    order: 16,
    brand: "Editorial portrait",
    title: "The camera becomes part of the character",
    curatorNote: "Low-key lighting, tactile grain, and crisp camera anatomy turn a simple portrait concept into an editorial frame.",
    goal: "entertain",
    media: {
      kind: "image",
      src: "/format-repositories/cinematic-photographer-v1/assets/source/example-output.png",
      referenceSrc: "/format-repositories/cinematic-photographer-v1/assets/source/style-reference.jpg",
      durationLabel: "Static",
    },
    format: {
      slug: "cinematic-photographer",
      name: "Cinematic Photographer",
      version: "1.0.0",
      owner: "Wiggly Studio",
    },
  },
  {
    id: "gta-vi-source",
    status: "published",
    order: 17,
    brand: "Portrait transformation",
    title: "Vice City at street level",
    curatorNote: "A recognizable subject sits inside a warm, neon, rain-slicked open-world frame without falling into cartoon styling.",
    goal: "entertain",
    media: {
      kind: "image",
      src: "/format-repositories/gta-vi-v1/assets/source/example-output.png",
      referenceSrc: "/format-repositories/gta-vi-v1/assets/source/reference-input.jpg",
      durationLabel: "Static",
    },
    format: {
      slug: "gta-vi",
      name: "GTA VI",
      version: "1.0.0",
      owner: "Wiggly Studio",
    },
  },
  ...productPhotoshootDiscoveryEntries,
  ...selfieNineDiscoveryEntries,
  ...ragDollDiscoveryEntries,
  ...moodNotesDiscoveryEntries,
  ...redDeadRedemptionDiscoveryEntries,
  ...oldMoneyShotDiscoveryEntries,
  ...chromeVoidDiscoveryEntries,
  ...ccdJpegFilterDiscoveryEntries,
  ...passportClickDiscoveryEntries,
  ...fakeItTillYouMakeItDiscoveryEntries,
  ...darkStudioPortraitDiscoveryEntries,
  ...bluePhosphorDiscoveryEntries,
  ...duskEffectDiscoveryEntries,
  ...sparklingEffectDiscoveryEntries,
  ...coolToneFilterDiscoveryEntries,
  ...haloEffectDiscoveryEntries,
  ...doodleArtDiscoveryEntries,
  ...lightSilhouetteDiscoveryEntries,
  ...rimPortraitFilterDiscoveryEntries,
  ...cyanotypeDiscoveryEntries,
  ...lordOfTheRingsDiscoveryEntries,
  ...softGlowFilterDiscoveryEntries,
  ...paperOutfitDiscoveryEntries,
  ...moodyPinkEffectDiscoveryEntries,
  ...cinematicPortraitPackDiscoveryEntries,
  ...dreamcoreAngelDiscoveryEntries,
  ...darkAestheticFilterDiscoveryEntries,
  ...twoThousandsEffectDiscoveryEntries,
  ...eightiesToonDiscoveryEntries,
  ...databaseFormatDiscoveryEntries.filter((entry) => entry.format.slug !== "motion-story"),
  ...jingleDiscoveryEntries,
  ...videoMemeDiscoveryEntries,
];

export type DiscoveryShelf = {
  id: string;
  title: string;
  description: string;
  entries: DiscoveryEntry[];
};

const discoveryShelfDefinitions = [
  {
    id: "product-stories",
    title: "Product Stories in Motion",
    description: "3D product stories and compact performance ads.",
    formats: ["three-d-breakdown"],
  },
  {
    id: "product-photoshoots",
    title: "Product Photoshoots",
    description: "One real product turned into a complete campaign-ready image set.",
    formats: ["product-photoshoot"],
  },
  {
    id: "mugsy-explains",
    title: "Mugsy Explains",
    description: "Quick comparisons with one recurring host and proof you can see.",
    formats: ["mugsy-explains"],
  },
  {
    id: "talking-fish-news",
    title: "Talking Fish News",
    description: "Real current stories delivered by one very serious fish.",
    formats: ["talking-fish-news"],
  },
  {
    id: "brand-jingles",
    title: "Songs People Remember",
    description: "Brand jingles built around one sharp buyer truth.",
    formats: ["jingle"],
  },
  {
    id: "video-memes",
    title: "Video Memes",
    description: "Familiar clips carrying brand-specific buyer truths.",
    formats: ["video-meme"],
  },
  {
    id: "brainrot",
    title: "Brainrot Ads",
    description: "Fast dialogue and chaos built to hold attention.",
    formats: ["brainrot"],
  },
  {
    id: "character-explainers",
    title: "Explain It With Characters",
    description: "Familiar characters make hard ideas and real promotions easy to follow.",
    formats: ["squilliam-news", "otaku-explainer"],
  },
  {
    id: "conversations",
    title: "Conversations That Sell",
    description: "Messages and voice-led pitches that feel native.",
    formats: ["text-message", "visualizer"],
  },
  {
    id: "written-content",
    title: "Words People Want to Read",
    description: "Brand-voice writing grounded in real company proof.",
    formats: ["newsletter-writer"],
  },
  {
    id: "skai-generated",
    title: "SKAI Image Transformations",
    description: "Image prompts gathered from @skaigenerated, ranked by comment engagement, and packaged as runnable Wiggly Formats.",
    formats: [
      "cinematic-portrait-pack",
      "dreamcore-angel",
      "dark-aesthetic-filter",
      "2000s-effect",
      "passport-click",
      "fake-it-till-you-make-it",
      "selfie-nine-images",
      "dark-studio-portrait",
      "blue-phosphor",
      "dusk-effect",
      "light-silhouette",
      "sparkling-effect",
      "cool-tone-filter",
      "fortnite-filter",
      "chrome-void",
      "halo-effect",
      "mood-notes",
      "doodle-art",
      "rim-portrait-filter",
      "paper-outfit",
      "moody-pink-effect",
      "gta-vi",
      "ccd-jpeg-filter",
      "cyanotype",
      "soft-glow-filter",
      "cinematic-photographer",
      "red-dead-redemption",
      "lord-of-the-rings",
      "rag-doll",
      "80s-toon",
      "old-money-shot",
    ],
  },
  {
    id: "static-hooks",
    title: "Static Ideas That Land",
    description: "Memes and announcements built to stop the scroll.",
    formats: ["meme", "hybrid-news"],
  },
  {
    id: "more",
    title: "More From Wiggly",
    description: "New experiments that do not have a shelf yet.",
    formats: [],
  },
] as const;

const shelfIdByFormat = new Map<string, string>(
  discoveryShelfDefinitions.flatMap((shelf) => (
    shelf.formats.map((format) => [format, shelf.id] as const)
  )),
);

export function groupDiscoveryEntriesByShelf(entries: DiscoveryEntry[]): DiscoveryShelf[] {
  const buckets = new Map<string, DiscoveryEntry[]>();
  for (const entry of entries) {
    const shelfId = shelfIdByFormat.get(entry.format.slug) || "more";
    const bucket = buckets.get(shelfId) || [];
    bucket.push(entry);
    buckets.set(shelfId, bucket);
  }

  return discoveryShelfDefinitions.flatMap((shelf) => {
    const shelfEntries = buckets.get(shelf.id);
    const formatOrder = shelf.formats as readonly string[];
    return shelfEntries?.length
      ? [{
          id: shelf.id,
          title: shelf.title,
          description: shelf.description,
          entries: [...shelfEntries].sort(
            (left, right) => formatOrder.indexOf(left.format.slug) - formatOrder.indexOf(right.format.slug),
          ),
        }]
      : [];
  });
}

export function getPublishedDiscoveryEntries(
  entries: DiscoveryEntry[] = discoveryCatalog,
): DiscoveryEntry[] {
  return entries
    .filter((entry) => entry.status === "published" && entry.showInDiscovery !== false)
    .sort((left, right) => left.order - right.order);
}

export function getPublishedDiscoveryProofEntries(
  entries: DiscoveryEntry[] = discoveryCatalog,
): DiscoveryEntry[] {
  return entries
    .filter((entry) => entry.status === "published")
    .sort((left, right) => left.order - right.order);
}

export function filterDiscoveryEntries(
  entries: DiscoveryEntry[],
  query: string,
  goal: DiscoveryGoal,
): DiscoveryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return entries.filter((entry) => {
    const matchesGoal = goal === "all" || entry.goal === goal;
    if (!matchesGoal) return false;
    if (!normalizedQuery) return true;

    return [
      entry.brand,
      entry.title,
      entry.format.name,
      entry.format.owner,
      entry.curatorNote,
    ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function getDiscoveryEntryById(id: string): DiscoveryEntry | undefined {
  return getPublishedDiscoveryProofEntries().find((entry) => entry.id === id);
}

export function getDiscoveryEntriesByFormat(formatSlug: string): DiscoveryEntry[] {
  return getPublishedDiscoveryProofEntries().filter((entry) => entry.format.slug === formatSlug);
}

export function getRelatedDiscoveryEntries(entry: DiscoveryEntry, limit = 3): DiscoveryEntry[] {
  return getDiscoveryEntriesByFormat(entry.format.slug)
    .filter((candidate) => candidate.id !== entry.id)
    .slice(0, limit);
}
