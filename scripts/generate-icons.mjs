// Generates Android and iOS launcher icons from the SVG app logo.
// Run with: node scripts/generate-icons.mjs

import sharp from 'sharp';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'static', 'ebr-gear-gradient.svg');
const resDir = join(root, 'android', 'app', 'src', 'main', 'res');
const iosIconDir = join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');

const svgBuffer = readFileSync(svgPath);

// Standard launcher icon sizes per density
const launcherSizes = {
	'mipmap-mdpi': 48,
	'mipmap-hdpi': 72,
	'mipmap-xhdpi': 96,
	'mipmap-xxhdpi': 144,
	'mipmap-xxxhdpi': 192,
};

// Adaptive icon foreground sizes (108dp base at each density)
const foregroundSizes = {
	'mipmap-mdpi': 108,
	'mipmap-hdpi': 162,
	'mipmap-xhdpi': 216,
	'mipmap-xxhdpi': 324,
	'mipmap-xxxhdpi': 432,
};

async function generate() {
	await sharp(svgBuffer)
		.resize(180, 180)
		.png()
		.toFile(join(root, 'static', 'apple-touch-icon.png'));
	console.log('static/apple-touch-icon.png (180x180)');

	for (const [folder, size] of Object.entries(launcherSizes)) {
		const outDir = join(resDir, folder);

		// ic_launcher.png
		await sharp(svgBuffer)
			.resize(size, size)
			.png()
			.toFile(join(outDir, 'ic_launcher.png'));
		console.log(`${folder}/ic_launcher.png (${size}x${size})`);

		// ic_launcher_round.png (same image, Android clips it)
		await sharp(svgBuffer)
			.resize(size, size)
			.png()
			.toFile(join(outDir, 'ic_launcher_round.png'));
		console.log(`${folder}/ic_launcher_round.png (${size}x${size})`);
	}

	for (const [folder, size] of Object.entries(foregroundSizes)) {
		const outDir = join(resDir, folder);

		// ic_launcher_foreground.png - icon centered on transparent bg
		// The icon occupies the inner 66% (safe zone for adaptive icons)
		const iconSize = Math.round(size * 0.66);
		const padding = Math.round((size - iconSize) / 2);

		const resized = await sharp(svgBuffer)
			.resize(iconSize, iconSize)
			.png()
			.toBuffer();

		await sharp({
			create: {
				width: size,
				height: size,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		})
			.composite([{ input: resized, left: padding, top: padding }])
			.png()
			.toFile(join(outDir, 'ic_launcher_foreground.png'));
		console.log(`${folder}/ic_launcher_foreground.png (${size}x${size})`);
	}

	if (existsSync(iosIconDir)) {
		await sharp(svgBuffer)
			.resize(1024, 1024)
			.png()
			.toFile(join(iosIconDir, 'AppIcon-512@2x.png'));
		console.log('ios/AppIcon.appiconset/AppIcon-512@2x.png (1024x1024)');
	}

	console.log('Done!');
}

generate().catch(console.error);
