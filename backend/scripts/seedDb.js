// Adds the sample public-domain books from database/seed-books.json.
// Books that already exist (same title and author) are skipped, so the script
// can be run several times. Usage: npm run db:seed
const books = require('../database/seed-books.json');
const { pool } = require('../src/config/db');
const bookModel = require('../src/models/bookModel');
const genreModel = require('../src/models/genreModel');
const describeDbError = require('../src/utils/describeDbError');

async function seed() {
  let added = 0;
  for (const book of books) {
    if (await bookModel.existsWithTitleAndAuthor(book.title, book.author)) continue;
    // Seeded books do not notify readers: they are the starting catalogue.
    const genre = (await genreModel.findByName(book.genre || 'Fiction')) || (await genreModel.findByName('Fiction'));
    await bookModel.create({ ...book, genreId: genre.id });
    added += 1;
  }
  console.log(`Added ${added} book(s); ${books.length - added} were already in the catalogue.`);
}

seed()
  .catch((err) => {
    console.error(`Seeding failed: ${describeDbError(err)}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
