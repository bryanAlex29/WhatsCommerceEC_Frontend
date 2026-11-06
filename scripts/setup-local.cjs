/* global __dirname */
const { constants, copyFileSync } = require('node:fs');
const path = require('node:path');

// COPYFILE_EXCL también protege ante una creación concurrente del destino.
function setupLocal(directory = path.resolve(__dirname, '..')) {
  try {
    copyFileSync(
      path.join(directory, '.env.example'),
      path.join(directory, '.env'),
      constants.COPYFILE_EXCL,
    );
    return { created: true };
  } catch (error) {
    if (error.code === 'EEXIST') return { created: false };
    throw error;
  }
}

if (require.main === module) {
  try {
    const { created } = setupLocal();
    console.log(created
      ? '.env creado desde .env.example. Revisa la URL pública para tu dispositivo antes de iniciar Expo.'
      : '.env ya existe: se conserva sin cambios.');
  } catch {
    console.error('No se pudo preparar .env. Revisa .env.example y los permisos del checkout.');
    process.exitCode = 1;
  }
}

module.exports = { setupLocal };
