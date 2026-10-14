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

// --- Más o menos goles: goles en Mundiales, actualizados después del Mundial
// 2026: jugadores retirados de su selección, más Mbappé y Messi, que no
// pueden sumar hasta el Mundial 2030. ---

export const WORLD_CUP_SCORERS: Array<{ name: string; goals: number }> = [
  // Después del Mundial 2026 (no cambian hasta 2030).
  { name: 'Kylian Mbappé', goals: 22 },
  { name: 'Lionel Messi', goals: 21 },
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

// Escudos de los demás clubes que aparecen en "Trayectoria" (de Wikipedia,
// revisados uno por uno). Los de la grilla salen de CLUB_CREST_URLS.
const CAREER_EXTRA_CRESTS: Record<string, string> = {
  "Malmö": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Malmo_FF_logo.svg/250px-Malmo_FF_logo.svg.png",
  "Nacional": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1e/Club_Nacional_de_Football_logo.svg/250px-Club_Nacional_de_Football_logo.svg.png",
  "Groningen": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2c/FC_Groningen_logo.svg/250px-FC_Groningen_logo.svg.png",
  "Grêmio": "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/08/Gremio_logo.svg/250px-Gremio_logo.svg.png",
  "Danubio": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/Escudo_oficial_de_Danubio_FC.png/250px-Escudo_oficial_de_Danubio_FC.png",
  "Palermo": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/df/Palermo_Calcio_logo_%282019%29.svg/250px-Palermo_Calcio_logo_%282019%29.svg.png",
  "Shanghai Shenhua": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/d3/Shanghai_Shenhua_F.C.svg/250px-Shanghai_Shenhua_F.C.svg.png",
  "Independiente": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Escudo_del_Club_Atl%C3%A9tico_Independiente.svg/250px-Escudo_del_Club_Atl%C3%A9tico_Independiente.svg.png",
  "Rayo Vallecano": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/d8/Rayo_Vallecano_logo.svg/250px-Rayo_Vallecano_logo.svg.png",
  "Millonarios": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f7/Millonarios_F%C3%BAtbol_Club_logo.svg/250px-Millonarios_F%C3%BAtbol_Club_logo.svg.png",
  "New York Red Bulls": "https://thumb.wikimedia.org/wikipedia/en/thumb/5/51/New_York_Red_Bulls_logo.svg/250px-New_York_Red_Bulls_logo.svg.png",
  "Preston North End": "https://thumb.wikimedia.org/wikipedia/en/thumb/8/82/Preston_North_End_FC.svg/250px-Preston_North_End_FC.svg.png",
  "Cruzeiro": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/90/Cruzeiro_Esporte_Clube_%28logo%29.svg/250px-Cruzeiro_Esporte_Clube_%28logo%29.svg.png",
  "Atlético Mineiro": "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/27/Clube_Atl%C3%A9tico_Mineiro_logo.svg/250px-Clube_Atl%C3%A9tico_Mineiro_logo.svg.png",
  "Querétaro": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/11/Quer%C3%A9taro_F.C._logo.svg/250px-Quer%C3%A9taro_F.C._logo.svg.png",
  "Fluminense": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/12/Fluminense_Football_Club.svg/250px-Fluminense_Football_Club.svg.png",
  "Orlando City": "https://thumb.wikimedia.org/wikipedia/en/thumb/6/6a/Orlando_City_2014.svg/250px-Orlando_City_2014.svg.png",
  "Nice": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/2e/OGC_Nice_logo.svg/250px-OGC_Nice_logo.svg.png",
  "Al-Gharafa": "https://thumb.wikimedia.org/wikipedia/en/thumb/7/79/Al-Gharafa_SC_logo.svg/250px-Al-Gharafa_SC_logo.svg.png",
  "Le Mans": "https://thumb.wikimedia.org/wikipedia/en/thumb/5/57/Le_Mans_FC_logo.svg/250px-Le_Mans_FC_logo.svg.png",
  "Guingamp": "https://thumb.wikimedia.org/wikipedia/en/thumb/5/56/En_Avant_Guingamp_logo.svg/250px-En_Avant_Guingamp_logo.svg.png",
  "Montreal Impact": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fe/Logo_of_CF_Montreal_2023.svg/250px-Logo_of_CF_Montreal_2023.svg.png",
  "Phoenix Rising": "https://thumb.wikimedia.org/wikipedia/en/thumb/9/93/Phoenix_Rising_FC_logo.svg/250px-Phoenix_Rising_FC_logo.svg.png",
  "Sagan Tosu": "https://thumb.wikimedia.org/wikipedia/en/thumb/c/c1/Sagan_Tosu_logo.svg/250px-Sagan_Tosu_logo.svg.png",
  "Como": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg/250px-Calcio_Como_-_logo_%28Italy%2C_2019-%29.svg.png",
  "Real Sociedad": "https://thumb.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/250px-Real_Sociedad_logo.svg.png",
  "Dinamo Zagreb": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/56/Logo_GNK_Dinamo_Zagreb_%282019%29.svg/250px-Logo_GNK_Dinamo_Zagreb_%282019%29.svg.png",
  "Basilea": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c1/FC_Basel_crest.svg/250px-FC_Basel_crest.svg.png",
  "Al-Shabab": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/2d/Al_Shabab_FC_%28Riyadh%29.svg/250px-Al_Shabab_FC_%28Riyadh%29.svg.png",
  "Hajduk Split": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/HNK_Hajduk_Split_logo.svg/250px-HNK_Hajduk_Split_logo.svg.png",
  "Znicz Pruszków": "https://upload.wikimedia.org/wikipedia/en/8/84/Znicz_Pruszkow.png",
  "Lech Poznań": "https://thumb.wikimedia.org/wikipedia/en/thumb/b/b0/KKS_Lech_Pozna%C5%84.svg/250px-KKS_Lech_Pozna%C5%84.svg.png",
  "Anderlecht": "https://thumb.wikimedia.org/wikipedia/en/thumb/7/77/R.S.C._Anderlecht.svg/250px-R.S.C._Anderlecht.svg.png",
  "West Bromwich": "https://thumb.wikimedia.org/wikipedia/en/thumb/8/8b/West_Bromwich_Albion.svg/250px-West_Bromwich_Albion.svg.png",
  "Lille": "https://thumb.wikimedia.org/wikipedia/en/thumb/3/3f/Lille_OSC_2018_logo.svg/250px-Lille_OSC_2018_logo.svg.png",
  "Genk": "https://thumb.wikimedia.org/wikipedia/en/thumb/5/53/KRC_Genk_logo.svg/250px-KRC_Genk_logo.svg.png",
  "Werder Bremen": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/be/SV-Werder-Bremen-Logo.svg/250px-SV-Werder-Bremen-Logo.svg.png",
  "Wolfsburg": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/VfL_Wolfsburg_logo_2026.svg/250px-VfL_Wolfsburg_logo_2026.svg.png",
  "Bryne": "https://thumb.wikimedia.org/wikipedia/en/thumb/6/6f/Bryne_FK_logo.svg/250px-Bryne_FK_logo.svg.png",
  "Molde": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Molde_Fotball_Logo.svg/250px-Molde_Fotball_Logo.svg.png",
  "Red Bull Salzburgo": "https://thumb.wikimedia.org/wikipedia/en/thumb/7/77/FC_Red_Bull_Salzburg_logo.svg/250px-FC_Red_Bull_Salzburg_logo.svg.png",
  "El Mokawloon": "https://upload.wikimedia.org/wikipedia/en/2/27/Al_Mokawloon_Al_Arab_SC_logo.png",
  "Metz": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4a/FC_Metz_2021_Logo.svg/250px-FC_Metz_2021_Logo.svg.png",
  "Southampton": "https://thumb.wikimedia.org/wikipedia/en/thumb/c/c9/FC_Southampton.svg/250px-FC_Southampton.svg.png",
  "Instituto": "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/fa/Instituto_acc_cordoba_logo.svg/250px-Instituto_acc_cordoba_logo.svg.png",
  "Colo-Colo": "https://thumb.wikimedia.org/wikipedia/en/thumb/b/be/Colo-Colo.svg/250px-Colo-Colo.svg.png",
  "Athletico Paranaense": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Athletico_Paranaense_%28Logo_2019%29.svg/250px-Athletico_Paranaense_%28Logo_2019%29.svg.png",
  "Atlas": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d2/F%C3%BAtbol_Club_Atlas.svg/250px-F%C3%BAtbol_Club_Atlas.svg.png",
  "León": "https://thumb.wikimedia.org/wikipedia/en/thumb/8/8f/Club_Leon_Logo.svg/250px-Club_Leon_Logo.svg.png",
  "Hellas Verona": "https://thumb.wikimedia.org/wikipedia/en/thumb/9/92/Hellas_Verona_FC_logo_%282020%29.svg/250px-Hellas_Verona_FC_logo_%282020%29.svg.png",
  "Newell's Old Boys": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/69/Escudo_del_Club_Atl%C3%A9tico_Newell%27s_Old_Boys_de_Rosario.svg/250px-Escudo_del_Club_Atl%C3%A9tico_Newell%27s_Old_Boys_de_Rosario.svg.png",
  "Al-Arabi": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/22/Al-Arabi_SC_Qatar_logo.svg/250px-Al-Arabi_SC_Qatar_logo.svg.png",
  "Parma": "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/Logo_Parma_Calcio_1913_%28adozione_2016%29.svg/250px-Logo_Parma_Calcio_1913_%28adozione_2016%29.svg.png",
  "Genoa": "https://thumb.wikimedia.org/wikipedia/en/thumb/2/2c/Genoa_CFC_crest.svg/250px-Genoa_CFC_crest.svg.png",
  "Internacional": "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c5/Sport_Club_Internacional_logo.svg/250px-Sport_Club_Internacional_logo.svg.png",
  "Cerezo Osaka": "https://thumb.wikimedia.org/wikipedia/en/thumb/8/85/Cerezo_Osaka_logo.svg/250px-Cerezo_Osaka_logo.svg.png",
  "Peñarol": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e9/Escudo_del_Club_Atl%C3%A9tico_Pe%C3%B1arol.svg/250px-Escudo_del_Club_Atl%C3%A9tico_Pe%C3%B1arol.svg.png",
  "Mumbai City": "https://thumb.wikimedia.org/wikipedia/en/thumb/6/68/Mumbai_City_FC_logo.svg/250px-Mumbai_City_FC_logo.svg.png",
  "Kitchee": "https://thumb.wikimedia.org/wikipedia/en/thumb/9/94/Kitchee_SC_crest.svg/250px-Kitchee_SC_crest.svg.png",
  "Stoke City": "https://thumb.wikimedia.org/wikipedia/en/thumb/b/bf/Stoke_City_FC_crest_2026.svg/250px-Stoke_City_FC_crest_2026.svg.png",
  "Los Angeles FC": "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/86/Los_Angeles_Football_Club.svg/250px-Los_Angeles_Football_Club.svg.png",
  "Brescia": "https://thumb.wikimedia.org/wikipedia/en/thumb/1/17/Brescia_calcio_badge.svg/250px-Brescia_calcio_badge.svg.png",
  "Reggina": "https://thumb.wikimedia.org/wikipedia/en/thumb/c/cd/AS_Reggina_1914_crest.svg/250px-AS_Reggina_1914_crest.svg.png",
  "New York City": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/eb/Logo_New_York_City_FC_2025.svg/250px-Logo_New_York_City_FC_2025.svg.png",
  "Sampdoria": "https://thumb.wikimedia.org/wikipedia/en/thumb/d/d2/U.C._Sampdoria_logo.svg/250px-U.C._Sampdoria_logo.svg.png",
  "Botafogo": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/52/Botafogo_de_Futebol_e_Regatas_logo.svg/250px-Botafogo_de_Futebol_e_Regatas_logo.svg.png",
  "Dinamo de Kiev": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/db/Futbolny_Klub_Dynamo_Kyiv_logo.svg/250px-Futbolny_Klub_Dynamo_Kyiv_logo.svg.png",
  "Argentinos Juniors": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5e/Asociaci%C3%B3n_Atl%C3%A9tica_Argentinos_Juniors_logo.svg/250px-Asociaci%C3%B3n_Atl%C3%A9tica_Argentinos_Juniors_logo.svg.png",
  "Hebei China Fortune": "https://thumb.wikimedia.org/wikipedia/en/thumb/f/fa/Hebei_F.C.svg/250px-Hebei_F.C.svg.png",
  "Estudiantes": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/15/Estudiantes_de_la_Plata_crest_%282025%29_cropped.svg/250px-Estudiantes_de_la_Plata_crest_%282025%29_cropped.svg.png",
  "Talleres (RE)": "https://upload.wikimedia.org/wikipedia/commons/9/9d/Talleres_ba_logo.png",
  "Banfield": "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/CA_Banfield_%282014%29.svg/250px-CA_Banfield_%282014%29.svg.png",
}

export function crestUrlFor(club: string): string | null {
  if (club === 'Al-Ittihad') return CLUB_CREST_URLS['Al Ittihad']
  return CLUB_CREST_URLS[club] ?? CAREER_EXTRA_CRESTS[club] ?? null
}
