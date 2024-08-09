import { getChart } from 'billboard-top-100'
import { Hono } from 'hono'
import { html, raw } from 'hono/html'
import { renderer } from './renderer'
import stringComparison from 'string-comparison'

const app = new Hono()

app.use(renderer)

let chart: any = null
let lev = stringComparison.levenshtein

app.get('/', async (c) => {
  let dates = [
    // '2010-08-01',
    // '2011-08-01',
    // '2012-08-01',
    // '2013-08-01',
    // '2014-08-01',
    // '2015-08-01',
    // '2016-08-01',
    // '2017-08-01',
    // '2018-08-01',
    // '2019-08-01',
    // '2020-08-01',
    // '2021-08-01',
    // '2022-08-01',
    '2023-08-01'
  ]
  var date = dates[Math.floor(Math.random()*dates.length)];
  chart = await getChart('hot-100', date)
  console.log(chart.songs)

  return c.render(
    <>
      <h1>Guess The Billboard Hot 100 for the week of: {chart.week}</h1>
      <p>
        Current Score: <span id='score'>0</span>
      </p>
      <p>
        Guesses Remaining: <span id='guesses-remaining'>5</span>
      </p>
      <form id='guess-form' hx-post='/guess' hx-swap='afterend'>
        <input id='guess' name='guess' type='text' />
        <button type='submit'>Submit</button>
      </form>
      <p id='error-message' style='color: red; display: none;'></p>
      <div id='game-over' style='display: none;'>
        <h2>Game Over!</h2>
        <p>
          You've used all your guesses. Final score:{' '}
          <span id='final-score'></span>
        </p>
        <button onclick='resetGame()'>Play Again</button>
      </div>
      <table id='guesses-table'></table>
      <script>
        {raw`
        let score = 0;
        let guessesRemaining = 5;
        let previousGuesses = new Set();

        function updateGuessesRemaining() {
          document.getElementById('guesses-remaining').textContent = guessesRemaining;
          if (guessesRemaining === 0) {
            document.getElementById('guess-form').style.display = 'none';
            document.getElementById('game-over').style.display = 'block';
            document.getElementById('final-score').textContent = score;
          }
        }

        function resetGame() {
          score = 0;
          guessesRemaining = 5;
          previousGuesses.clear();
          document.getElementById('score').textContent = score;
          updateGuessesRemaining();
          document.getElementById('guess-form').style.display = 'block';
          document.getElementById('game-over').style.display = 'none';
          document.getElementById('guesses-table').innerHTML = '';
          document.getElementById('error-message').style.display = 'none';
        }

        document.getElementById('guess-form').addEventListener('htmx:beforeRequest', (event) => {
          const guess = event.detail.requestConfig.parameters.guess.toLowerCase();
          if (previousGuesses.has(guess)) {
            event.preventDefault();
            document.getElementById('error-message').textContent = "You've already guessed that song!";
            document.getElementById('error-message').style.display = 'block';
          } else {
            previousGuesses.add(guess);
            document.getElementById('error-message').style.display = 'none';
          }
        });

        document.body.addEventListener('htmx:afterRequest', (event) => {
          if (event.detail.elt.matches('form') && event.detail.successful) {
            guessesRemaining--;
            updateGuessesRemaining();

            const songReturnItem = document.getElementById('song-return-item');
            if (songReturnItem) {
              const rank = parseInt(songReturnItem.dataset.rank);
              if (rank > 0) {
                const pointsEarned = calculatePoints(rank);
                score += pointsEarned;
                document.getElementById('score').textContent = score;
              }
              document.getElementById('guesses-table').appendChild(songReturnItem);
            }
          }
        });

        function calculatePoints(rank) {
          if (rank <= 10) return 10;
          if (rank <= 20) return 8;
          if (rank <= 50) return 5;
          return 3;
        }
      `}
      </script>
    </>
  )
})

async function inChart(guess: string) {
  // const found = chart.songs.find((song: any) => song.title === guess)
  const found = chart.songs.find((song: any) => lev.similarity(guess, song.title) > 0.93)
  console.log(found)
  return found
}

app.post('/guess', async (c) => {
  const body = await c.req.parseBody()
  const guess = body.guess as string
  const songinChart = await inChart(guess)

  return c.html(html`
    <tr
      id="song-return-item"
      data-rank="${songinChart ? songinChart.rank : '0'}"
    >
      ${songinChart
        ? html`
            <tr class='song-row'>
              <th class='row-rank'>${songinChart.rank}</th>
              <th class='row-cover'><img src="${songinChart.cover}" /></th>
              <th class='row-title'>${songinChart.title}</th>
              <th class='row-artist'>${songinChart.artist}</th>
            </tr>
          `
        : html` <th colspan="4">Song not found in chart</th> `}
    </tr>
  `)
})

export default app
