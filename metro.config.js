const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// السماح بامتدادات الصوت بما فيها m4a
config.resolver.assetExts.push('m4a', 'mp3', 'wav');

module.exports = config;