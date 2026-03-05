use rand::seq::SliceRandom;

/// Built-in word list for padding when players don't submit enough words.
/// Curated for fun Codenames gameplay — concrete nouns and evocative words.
const WORDS: &[&str] = &[
    "Africa", "Agent", "Air", "Alien", "Amazon", "Angel", "Ant", "Apple",
    "Arm", "Atlantis", "Australia", "Aztec", "Back", "Ball", "Band", "Bank",
    "Bar", "Bark", "Bat", "Battery", "Beach", "Bear", "Beat", "Bed",
    "Beijing", "Bell", "Belt", "Berlin", "Berry", "Bikini", "Block", "Board",
    "Bolt", "Bomb", "Bond", "Boom", "Boot", "Bottle", "Bow", "Box",
    "Bridge", "Brush", "Buck", "Buffalo", "Bug", "Bugle", "Button", "Cab",
    "Canada", "Cap", "Capital", "Car", "Card", "Carrot", "Casino", "Cast",
    "Cat", "Cell", "Center", "Chair", "Change", "Charge", "Check", "Chest",
    "Chick", "China", "Chocolate", "Church", "Circle", "Cliff", "Cloak", "Clock",
    "Cloud", "Clown", "Club", "Coach", "Coal", "Coat", "Cold", "Comic",
    "Compound", "Cone", "Contract", "Cook", "Copper", "Cotton", "Court", "Cover",
    "Crane", "Crash", "Cricket", "Cross", "Crown", "Cycle", "Czech", "Dance",
    "Date", "Day", "Death", "Deck", "Degree", "Diamond", "Dice", "Dinosaur",
    "Dish", "Doctor", "Dog", "Draft", "Dragon", "Dress", "Drill", "Drop",
    "Duck", "Dwarf", "Eagle", "Egypt", "Embassy", "Engine", "England", "Europe",
    "Eye", "Face", "Fair", "Fall", "Fan", "Fence", "Field", "Fighter",
    "Figure", "File", "Film", "Fire", "Fish", "Flat", "Fly", "Foot",
    "Force", "Forest", "Fork", "France", "Game", "Gas", "Genius", "Germany",
    "Ghost", "Giant", "Glass", "Glove", "Gold", "Gorilla", "Grace", "Grass",
    "Greece", "Green", "Ground", "Guitar", "Ham", "Hammer", "Hand", "Hawk",
    "Head", "Heart", "Helicopter", "Himalayas", "Hole", "Hollywood", "Honey", "Hood",
    "Hook", "Horn", "Horse", "Hospital", "Hotel", "House", "Ice", "Iceberg",
    "India", "Iron", "Ivory", "Jack", "Jam", "Jet", "Jupiter", "Kangaroo",
    "Ketchup", "Key", "Kid", "King", "Kite", "Knight", "Lab", "Lap",
    "Laser", "Lawyer", "Lead", "Lemon", "Leprechaun", "Life", "Light", "Limousine",
    "Line", "Link", "Lion", "Lock", "Log", "London", "Luck", "Mail",
    "Mammoth", "Maple", "Marble", "March", "Mask", "Mass", "Match", "Mercury",
    "Mexico", "Microscope", "Millionaire", "Mine", "Mint", "Missile", "Model", "Mole",
    "Moon", "Moscow", "Mount", "Mouse", "Mouth", "Mug", "Nail", "Needle",
    "Net", "New York", "Night", "Ninja", "Note", "Novel", "Nurse", "Nut",
    "Octopus", "Oil", "Olive", "Olympus", "Opera", "Orange", "Organ", "Palm",
    "Pan", "Pants", "Paper", "Parachute", "Park", "Part", "Pass", "Paste",
    "Penguin", "Phoenix", "Piano", "Pie", "Pilot", "Pin", "Pipe", "Pirate",
    "Pistol", "Pit", "Pitch", "Planet", "Plate", "Play", "Plot", "Point",
    "Poison", "Pole", "Police", "Pool", "Port", "Post", "Pound", "Press",
    "Princess", "Pumpkin", "Pupil", "Pyramid", "Queen", "Rabbit", "Racket", "Ray",
    "Revolution", "Ring", "Robin", "Robot", "Rock", "Rome", "Root", "Rose",
    "Roulette", "Round", "Row", "Ruler", "Satellite", "Saturn", "Scale", "School",
    "Scientist", "Scorpion", "Screen", "Scuba", "Seal", "Server", "Shadow", "Shakespeare",
    "Shanghai", "Sharp", "Sheet", "Shell", "Ship", "Shoe", "Shoot", "Shop",
    "Shot", "Shoulder", "Silk", "Silver", "Singer", "Sink", "Skyscraper", "Slip",
    "Slug", "Smuggler", "Snow", "Snowman", "Sock", "Soldier", "Soul", "Sound",
    "Space", "Spell", "Spider", "Spike", "Spot", "Spring", "Spy", "Square",
    "Stadium", "Staff", "Star", "State", "Steak", "Steam", "Steel", "Stick",
    "Stock", "Straw", "Stream", "Strike", "String", "Sub", "Suit", "Superhero",
    "Swing", "Switch", "Table", "Tail", "Tank", "Tap", "Teacher", "Temple",
    "Texas", "Theater", "Thief", "Thumb", "Tick", "Tie", "Tiger", "Time",
    "Tokyo", "Tooth", "Torch", "Tower", "Track", "Train", "Triangle", "Trip",
    "Trunk", "Tube", "Turkey", "Undertaker", "Unicorn", "Vacuum", "Van", "Vet",
    "Viking", "Volcano", "Wall", "War", "Washer", "Washington", "Watch", "Water",
    "Wave", "Web", "Well", "Whale", "Whip", "Wind", "Witch", "Worm",
    "Yard", "Zombie",
];

/// Total number of words in the built-in dictionary.
pub fn word_count() -> usize {
    WORDS.len()
}

/// Pick `count` random words from the dictionary, excluding any in `exclude`.
pub fn random_words(count: usize, exclude: &[String]) -> Vec<String> {
    let mut rng = rand::thread_rng();
    let mut available: Vec<&str> = WORDS
        .iter()
        .copied()
        .filter(|w| {
            !exclude
                .iter()
                .any(|e| e.eq_ignore_ascii_case(w))
        })
        .collect();
    available.shuffle(&mut rng);
    available.into_iter().take(count).map(String::from).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dictionary_has_enough_words() {
        assert!(word_count() >= 400, "Dictionary should have at least 400 words");
    }

    #[test]
    fn dictionary_has_no_duplicates() {
        let mut seen = std::collections::HashSet::new();
        for word in WORDS {
            let lower = word.to_lowercase();
            assert!(seen.insert(lower), "Duplicate word in dictionary: {}", word);
        }
    }

    #[test]
    fn random_words_returns_requested_count() {
        let words = random_words(10, &[]);
        assert_eq!(words.len(), 10);
    }

    #[test]
    fn random_words_excludes_specified_words() {
        let exclude = vec!["Africa".to_string(), "Agent".to_string()];
        let words = random_words(50, &exclude);
        for w in &words {
            assert!(!w.eq_ignore_ascii_case("Africa"));
            assert!(!w.eq_ignore_ascii_case("Agent"));
        }
    }

    #[test]
    fn random_words_excludes_case_insensitively() {
        let exclude = vec!["africa".to_string()];
        let words = random_words(word_count(), &exclude);
        assert!(!words.iter().any(|w| w.eq_ignore_ascii_case("africa")));
    }

    #[test]
    fn random_words_caps_at_available() {
        let words = random_words(9999, &[]);
        assert_eq!(words.len(), word_count());
    }

    #[test]
    fn random_words_returns_no_duplicates() {
        let words = random_words(50, &[]);
        let set: std::collections::HashSet<_> = words.iter().collect();
        assert_eq!(set.len(), words.len());
    }
}
