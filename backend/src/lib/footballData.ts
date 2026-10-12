// Datos de fútbol para los minijuegos (grilla, trayectoria, escudos y
// goleadores). Son datos históricos y estables; los clubes de cada jugador
// solo incluyen los que importan para la grilla (no toda la carrera).

import { CLUB_CREST_URLS, GRID_CLUBS, NATION_FLAG_CODES, RAW_PLAYERS, type GridTag } from './footballPlayers'

export { CLUB_CREST_URLS, GRID_CLUBS, NATION_FLAG_CODES, type GridTag }

export interface GridPlayer {
  name: string
  nation: string
  clubs: string[]
  tags: GridTag[]
}

export const GRID_PLAYERS: GridPlayer[] = RAW_PLAYERS.map(([name, nation, clubs, tags]) => ({ name, nation, clubs, tags }))

export const GRID_TAG_LABELS: Record<GridTag, string> = {
  BO: 'Ganó el Balón de Oro',
  WC: 'Campeón del mundo',
}

// --- Trayectoria: clubes en orden (sin cesiones menores) ---

export interface CareerPlayer {
  name: string
  nation: string
  position: string
  clubs: string[]
}

export const CAREERS: CareerPlayer[] = [
  { name: 'Lionel Messi', nation: 'Argentina', position: 'Delantero', clubs: ['Barcelona', 'PSG', 'Inter Miami'] },
  { name: 'Cristiano Ronaldo', nation: 'Portugal', position: 'Delantero', clubs: ['Sporting', 'Manchester United', 'Real Madrid', 'Juventus', 'Manchester United', 'Al Nassr'] },
  { name: 'Neymar', nation: 'Brasil', position: 'Delantero', clubs: ['Santos', 'Barcelona', 'PSG', 'Al Hilal', 'Santos'] },
  { name: 'Zlatan Ibrahimović', nation: 'Suecia', position: 'Delantero', clubs: ['Malmö', 'Ajax', 'Juventus', 'Inter', 'Barcelona', 'Milan', 'PSG', 'Manchester United', 'LA Galaxy', 'Milan'] },
  { name: 'Luis Suárez', nation: 'Uruguay', position: 'Delantero', clubs: ['Nacional', 'Groningen', 'Ajax', 'Liverpool', 'Barcelona', 'Atlético de Madrid', 'Nacional', 'Grêmio', 'Inter Miami'] },
  { name: 'Edinson Cavani', nation: 'Uruguay', position: 'Delantero', clubs: ['Danubio', 'Palermo', 'Napoli', 'PSG', 'Manchester United', 'Valencia', 'Boca Juniors'] },
  { name: 'Gonzalo Higuaín', nation: 'Argentina', position: 'Delantero', clubs: ['River Plate', 'Real Madrid', 'Napoli', 'Juventus', 'Milan', 'Chelsea', 'Juventus', 'Inter Miami'] },
  { name: 'Carlos Tevez', nation: 'Argentina', position: 'Delantero', clubs: ['Boca Juniors', 'Corinthians', 'West Ham', 'Manchester United', 'Manchester City', 'Juventus', 'Boca Juniors', 'Shanghai Shenhua', 'Boca Juniors'] },
  { name: 'Sergio Agüero', nation: 'Argentina', position: 'Delantero', clubs: ['Independiente', 'Atlético de Madrid', 'Manchester City', 'Barcelona'] },
  { name: 'Radamel Falcao', nation: 'Colombia', position: 'Delantero', clubs: ['River Plate', 'Porto', 'Atlético de Madrid', 'Monaco', 'Manchester United', 'Chelsea', 'Monaco', 'Galatasaray', 'Rayo Vallecano', 'Millonarios'] },
  { name: 'Thierry Henry', nation: 'Francia', position: 'Delantero', clubs: ['Monaco', 'Juventus', 'Arsenal', 'Barcelona', 'New York Red Bulls'] },
  { name: 'David Beckham', nation: 'Inglaterra', position: 'Mediocampista', clubs: ['Manchester United', 'Preston North End', 'Real Madrid', 'LA Galaxy', 'Milan', 'PSG'] },
  { name: 'Ronaldo Nazário', nation: 'Brasil', position: 'Delantero', clubs: ['Cruzeiro', 'PSV', 'Barcelona', 'Inter', 'Real Madrid', 'Milan', 'Corinthians'] },
  { name: 'Ronaldinho', nation: 'Brasil', position: 'Mediocampista ofensivo', clubs: ['Grêmio', 'PSG', 'Barcelona', 'Milan', 'Flamengo', 'Atlético Mineiro', 'Querétaro', 'Fluminense'] },
  { name: 'Kaká', nation: 'Brasil', position: 'Mediocampista ofensivo', clubs: ['São Paulo', 'Milan', 'Real Madrid', 'Milan', 'São Paulo', 'Orlando City'] },
  { name: 'Arjen Robben', nation: 'Países Bajos', position: 'Extremo', clubs: ['Groningen', 'PSV', 'Chelsea', 'Real Madrid', 'Bayern', 'Groningen'] },
  { name: 'Robin van Persie', nation: 'Países Bajos', position: 'Delantero', clubs: ['Feyenoord', 'Arsenal', 'Manchester United', 'Fenerbahçe', 'Feyenoord'] },
  { name: 'Wesley Sneijder', nation: 'Países Bajos', position: 'Mediocampista', clubs: ['Ajax', 'Real Madrid', 'Inter', 'Galatasaray', 'Nice', 'Al-Gharafa'] },
  { name: 'Didier Drogba', nation: 'Costa de Marfil', position: 'Delantero', clubs: ['Le Mans', 'Guingamp', 'Marsella', 'Chelsea', 'Shanghai Shenhua', 'Galatasaray', 'Chelsea', 'Montreal Impact', 'Phoenix Rising'] },
  { name: 'Fernando Torres', nation: 'España', position: 'Delantero', clubs: ['Atlético de Madrid', 'Liverpool', 'Chelsea', 'Milan', 'Atlético de Madrid', 'Sagan Tosu'] },
  { name: 'Cesc Fàbregas', nation: 'España', position: 'Mediocampista', clubs: ['Arsenal', 'Barcelona', 'Chelsea', 'Monaco', 'Como'] },
  { name: 'Xabi Alonso', nation: 'España', position: 'Mediocampista', clubs: ['Real Sociedad', 'Liverpool', 'Real Madrid', 'Bayern'] },
  { name: 'Luka Modrić', nation: 'Croacia', position: 'Mediocampista', clubs: ['Dinamo Zagreb', 'Tottenham', 'Real Madrid', 'Milan'] },
  { name: 'Ivan Rakitić', nation: 'Croacia', position: 'Mediocampista', clubs: ['Basilea', 'Schalke 04', 'Sevilla', 'Barcelona', 'Sevilla', 'Al-Shabab', 'Hajduk Split'] },
  { name: 'Robert Lewandowski', nation: 'Polonia', position: 'Delantero', clubs: ['Znicz Pruszków', 'Lech Poznań', 'Borussia Dortmund', 'Bayern', 'Barcelona'] },
  { name: 'Romelu Lukaku', nation: 'Bélgica', position: 'Delantero', clubs: ['Anderlecht', 'Chelsea', 'West Bromwich', 'Everton', 'Manchester United', 'Inter', 'Chelsea', 'Inter', 'Roma', 'Napoli'] },
  { name: 'Eden Hazard', nation: 'Bélgica', position: 'Extremo', clubs: ['Lille', 'Chelsea', 'Real Madrid'] },
  { name: 'Kevin De Bruyne', nation: 'Bélgica', position: 'Mediocampista', clubs: ['Genk', 'Chelsea', 'Werder Bremen', 'Chelsea', 'Wolfsburg', 'Manchester City', 'Napoli'] },
  { name: 'Antoine Griezmann', nation: 'Francia', position: 'Delantero', clubs: ['Real Sociedad', 'Atlético de Madrid', 'Barcelona', 'Atlético de Madrid'] },
  { name: 'Karim Benzema', nation: 'Francia', position: 'Delantero', clubs: ['Lyon', 'Real Madrid', 'Al-Ittihad'] },
  { name: 'Kylian Mbappé', nation: 'Francia', position: 'Delantero', clubs: ['Monaco', 'PSG', 'Real Madrid'] },
  { name: 'Erling Haaland', nation: 'Noruega', position: 'Delantero', clubs: ['Bryne', 'Molde', 'Red Bull Salzburgo', 'Borussia Dortmund', 'Manchester City'] },
  { name: 'Mohamed Salah', nation: 'Egipto', position: 'Extremo', clubs: ['El Mokawloon', 'Basilea', 'Chelsea', 'Fiorentina', 'Roma', 'Liverpool'] },
  { name: 'Sadio Mané', nation: 'Senegal', position: 'Extremo', clubs: ['Metz', 'Red Bull Salzburgo', 'Southampton', 'Liverpool', 'Bayern', 'Al Nassr'] },
  { name: 'Paul Pogba', nation: 'Francia', position: 'Mediocampista', clubs: ['Manchester United', 'Juventus', 'Manchester United', 'Juventus', 'Monaco'] },
  { name: 'Paulo Dybala', nation: 'Argentina', position: 'Delantero', clubs: ['Instituto', 'Palermo', 'Juventus', 'Roma'] },
  { name: 'Arturo Vidal', nation: 'Chile', position: 'Mediocampista', clubs: ['Colo-Colo', 'Bayer Leverkusen', 'Juventus', 'Bayern', 'Barcelona', 'Inter', 'Flamengo', 'Athletico Paranaense', 'Colo-Colo'] },
  { name: 'Javier "Chicharito" Hernández', nation: 'México', position: 'Delantero', clubs: ['Chivas', 'Manchester United', 'Real Madrid', 'Bayer Leverkusen', 'West Ham', 'Sevilla', 'LA Galaxy', 'Chivas'] },
  { name: 'Rafael Márquez', nation: 'México', position: 'Defensor', clubs: ['Atlas', 'Monaco', 'Barcelona', 'New York Red Bulls', 'León', 'Hellas Verona', 'Atlas'] },
  { name: 'Gabriel Batistuta', nation: 'Argentina', position: 'Delantero', clubs: ["Newell's Old Boys", 'River Plate', 'Boca Juniors', 'Fiorentina', 'Roma', 'Inter', 'Al-Arabi'] },
  { name: 'Hernán Crespo', nation: 'Argentina', position: 'Delantero', clubs: ['River Plate', 'Parma', 'Lazio', 'Inter', 'Chelsea', 'Milan', 'Chelsea', 'Inter', 'Genoa', 'Parma'] },
  { name: 'Diego Forlán', nation: 'Uruguay', position: 'Delantero', clubs: ['Independiente', 'Manchester United', 'Villarreal', 'Atlético de Madrid', 'Inter', 'Internacional', 'Cerezo Osaka', 'Peñarol', 'Mumbai City', 'Kitchee'] },
  { name: 'Michael Owen', nation: 'Inglaterra', position: 'Delantero', clubs: ['Liverpool', 'Real Madrid', 'Newcastle', 'Manchester United', 'Stoke City'] },
  { name: 'Gareth Bale', nation: 'Gales', position: 'Extremo', clubs: ['Southampton', 'Tottenham', 'Real Madrid', 'Tottenham', 'Real Madrid', 'Los Angeles FC'] },
  { name: 'Gianluigi Buffon', nation: 'Italia', position: 'Portero', clubs: ['Parma', 'Juventus', 'PSG', 'Juventus', 'Parma'] },
  { name: 'Andrea Pirlo', nation: 'Italia', position: 'Mediocampista', clubs: ['Brescia', 'Inter', 'Reggina', 'Brescia', 'Milan', 'Juventus', 'New York City'] },
  { name: 'Clarence Seedorf', nation: 'Países Bajos', position: 'Mediocampista', clubs: ['Ajax', 'Sampdoria', 'Real Madrid', 'Inter', 'Milan', 'Botafogo'] },
  { name: 'Andriy Shevchenko', nation: 'Ucrania', position: 'Delantero', clubs: ['Dinamo de Kiev', 'Milan', 'Chelsea', 'Milan', 'Dinamo de Kiev'] },
  { name: 'Patrick Kluivert', nation: 'Países Bajos', position: 'Delantero', clubs: ['Ajax', 'Milan', 'Barcelona', 'Newcastle', 'Valencia', 'PSV', 'Lille'] },
  { name: 'Dennis Bergkamp', nation: 'Países Bajos', position: 'Delantero', clubs: ['Ajax', 'Inter', 'Arsenal'] },
  { name: 'Juan Román Riquelme', nation: 'Argentina', position: 'Mediocampista ofensivo', clubs: ['Boca Juniors', 'Barcelona', 'Villarreal', 'Boca Juniors', 'Argentinos Juniors'] },
  { name: 'Javier Mascherano', nation: 'Argentina', position: 'Mediocampista', clubs: ['River Plate', 'Corinthians', 'West Ham', 'Liverpool', 'Barcelona', 'Hebei China Fortune', 'Estudiantes'] },
  { name: 'Javier Zanetti', nation: 'Argentina', position: 'Defensor', clubs: ['Talleres (RE)', 'Banfield', 'Inter'] },
]

// --- Escudo borroso: clubes cuyo escudo se puede adivinar (Marsella no,
// porque estrenó escudo nuevo en 2026 y casi nadie lo reconoce todavía). ---

export interface CrestClub {
  name: string
  country: string
  url: string
}

const CREST_COUNTRIES: Record<string, string> = {
  Arsenal: 'Inglaterra', 'Aston Villa': 'Inglaterra', Chelsea: 'Inglaterra', Everton: 'Inglaterra',
  Liverpool: 'Inglaterra', 'Manchester City': 'Inglaterra', 'Manchester United': 'Inglaterra', Newcastle: 'Inglaterra',
  Tottenham: 'Inglaterra', 'West Ham': 'Inglaterra', 'Real Madrid': 'España', Barcelona: 'España',
  'Atlético de Madrid': 'España', Sevilla: 'España', Valencia: 'España', Villarreal: 'España', 'Real Betis': 'España',
  Bayern: 'Alemania', 'Borussia Dortmund': 'Alemania', 'Bayer Leverkusen': 'Alemania', 'Schalke 04': 'Alemania',
  Juventus: 'Italia', Milan: 'Italia', Inter: 'Italia', Roma: 'Italia', Napoli: 'Italia', Lazio: 'Italia',
  Fiorentina: 'Italia', PSG: 'Francia', Lyon: 'Francia', Monaco: 'Francia', Ajax: 'Países Bajos', PSV: 'Países Bajos',
  Feyenoord: 'Países Bajos', Porto: 'Portugal', Benfica: 'Portugal', Sporting: 'Portugal', Celtic: 'Escocia',
  Galatasaray: 'Turquía', Fenerbahçe: 'Turquía', Flamengo: 'Brasil', Palmeiras: 'Brasil', Corinthians: 'Brasil',
  'São Paulo': 'Brasil', Santos: 'Brasil', 'Boca Juniors': 'Argentina', 'River Plate': 'Argentina', América: 'México',
  Chivas: 'México', 'Inter Miami': 'Estados Unidos', 'LA Galaxy': 'Estados Unidos', 'Al Nassr': 'Arabia Saudita',
  'Al Hilal': 'Arabia Saudita', 'Al Ittihad': 'Arabia Saudita',
}

export const CRESTS: CrestClub[] = Object.entries(CREST_COUNTRIES).map(([name, country]) => ({
  name,
  country,
  url: CLUB_CREST_URLS[name],
}))

// Clubes extra solo para el buscador de "Escudo borroso" (no tienen escudo
// en el juego, pero hacen que la respuesta no salga por descarte).
export const EXTRA_CLUB_NAMES = [
  'Marsella', 'Lille', 'Leicester City', 'Brighton', 'Wolverhampton', 'Crystal Palace', 'Girona', 'Osasuna',
  'Celta de Vigo', 'Eintracht Frankfurt', 'RB Leipzig', 'Borussia Mönchengladbach', 'Wolfsburg', 'Atalanta',
  'Torino', 'Sampdoria', 'Genoa', 'Nice', 'Rennes', 'Anderlecht', 'Club Brujas', 'Rangers', 'Fenerbahçe', 'Beşiktaş',
  'Olympiacos', 'Shakhtar Donetsk', 'Dinamo Zagreb', 'Estrella Roja', 'Red Bull Salzburgo', 'Basilea', 'Grêmio',
  'Cruzeiro', 'Internacional', 'Fluminense', 'Peñarol', 'Nacional', 'Colo-Colo', 'Millonarios', 'Atlético Nacional',
]

// --- Más o menos goles: goles en Mundiales de jugadores ya retirados de su
// selección (números cerrados, no cambian). ---

export const WORLD_CUP_SCORERS: Array<{ name: string; goals: number }> = [
  { name: 'Miroslav Klose', goals: 16 },
  { name: 'Ronaldo Nazário', goals: 15 },
  { name: 'Gerd Müller', goals: 14 },
  { name: 'Just Fontaine', goals: 13 },
  { name: 'Pelé', goals: 12 },
  { name: 'Sándor Kocsis', goals: 11 },
  { name: 'Jürgen Klinsmann', goals: 11 },
  { name: 'Helmut Rahn', goals: 10 },
  { name: 'Teófilo Cubillas', goals: 10 },
  { name: 'Grzegorz Lato', goals: 10 },
  { name: 'Gary Lineker', goals: 10 },
  { name: 'Gabriel Batistuta', goals: 10 },
  { name: 'Thomas Müller', goals: 10 },
  { name: 'Ademir', goals: 9 },
  { name: 'Vavá', goals: 9 },
  { name: 'Uwe Seeler', goals: 9 },
  { name: 'Eusébio', goals: 9 },
  { name: 'Jairzinho', goals: 9 },
  { name: 'Paolo Rossi', goals: 9 },
  { name: 'Karl-Heinz Rummenigge', goals: 9 },
  { name: 'Roberto Baggio', goals: 9 },
  { name: 'Christian Vieri', goals: 9 },
  { name: 'David Villa', goals: 9 },
  { name: 'Leônidas', goals: 8 },
  { name: 'Óscar Míguez', goals: 8 },
  { name: 'Guillermo Stábile', goals: 8 },
  { name: 'Diego Maradona', goals: 8 },
  { name: 'Rivaldo', goals: 8 },
  { name: 'Mario Kempes', goals: 6 },
  { name: 'Hristo Stoichkov', goals: 6 },
  { name: 'Davor Šuker', goals: 6 },
  { name: 'Diego Forlán', goals: 6 },
  { name: 'Zinedine Zidane', goals: 5 },
  { name: 'Roger Milla', goals: 5 },
  { name: 'Salvatore Schillaci', goals: 6 },
  { name: 'Oleg Salenko', goals: 6 },
]
