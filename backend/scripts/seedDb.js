// Adds the sample public-domain books from database/seed-books.json.
// Books that already exist (same title and author) are skipped, so the script
// can be run several times. Usage: npm run db:seed
const books = require('../database/seed-books.json');
const { pool } = require('../src/config/db');
const bookModel = require('../src/models/bookModel');
const describeDbError = require('../src/utils/describeDbError');

async function seed() {
  let added = 0;
  for (const book of books) {
    if (await bookModel.existsWithTitleAndAuthor(book.title, book.author)) continue;
    await bookModel.create(book);
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
