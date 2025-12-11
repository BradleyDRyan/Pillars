//
//  OnboardingPrinciple.swift
//  Pillars
//
//  Model for principle selection during onboarding
//

import Foundation

// MARK: - Dynamic Content Models (from API)

/// Content fetched from the backend for onboarding
struct OnboardingContent: Codable {
    let content: [OnboardingPillarContent]
}

struct OnboardingPillarContent: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let icon: String?
    let color: String
    let order: Int
    let isActive: Bool
    let themes: [OnboardingThemeContent]
}

struct OnboardingThemeContent: Codable, Identifiable {
    let id: String
    let pillarId: String
    let title: String
    let description: String
    let order: Int
    let isActive: Bool
    let principles: [String]
}

// MARK: - Theme (Short 1-2 word category)

struct OnboardingTheme: Identifiable, Equatable {
    let id: String
    let title: String  // Short: "Forgiveness", "Communication", "Intimacy"
    let principles: [String]  // Longer statements
    
    init(id: String = UUID().uuidString, title: String, principles: [String]) {
        self.id = id
        self.title = title
        self.principles = principles
    }
    
    /// Initialize from API content
    init(from content: OnboardingThemeContent) {
        self.id = content.id
        self.title = content.title
        self.principles = content.principles
    }
}

// MARK: - Seed Data

extension OnboardingTheme {
    
    static func themes(for pillarId: String) -> [OnboardingTheme] {
        switch pillarId {
        case "finances":
            return financeThemes
        case "family":
            return familyThemes
        case "marriage":
            return marriageThemes
        case "parenting":
            return parentingThemes
        case "faith":
            return faithThemes
        case "fitness":
            return fitnessThemes
        case "work":
            return workThemes
        case "friendships":
            return friendshipsThemes
        case "home":
            return homeThemes
        case "self":
            return selfThemes
        default:
            return defaultThemes
        }
    }
    
    // MARK: - Finance Themes
    
    static let financeThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Awareness",
            principles: [
                "Track every dollar, every week. No mystery money—I know where it all goes.",
                "Review my spending weekly without judgment. Awareness precedes change.",
                "Every purchase is a conscious choice, not a reaction.",
                "I check my accounts regularly. Ignorance is not bliss with money."
            ]
        ),
        OnboardingTheme(
            title: "Debt Freedom",
            principles: [
                "If I can't pay cash, I can't afford it. Credit is not income.",
                "Pay off what I owe before I buy what I want. Freedom over stuff.",
                "Debt steals from my future self. I refuse to borrow from tomorrow.",
                "I attack debt with intensity. Every extra dollar goes to what I owe."
            ]
        ),
        OnboardingTheme(
            title: "Security",
            principles: [
                "Pay myself first, every paycheck. Saving isn't what's left—it's what comes first.",
                "Keep six months of expenses untouched. Sleep-at-night money before fun money.",
                "Prepare for the storm while it's sunny. Emergencies aren't emergencies when you're ready.",
                "Insurance protects what I've built. I don't gamble with catastrophe."
            ]
        ),
        OnboardingTheme(
            title: "Investing",
            principles: [
                "Invest consistently, regardless of what the market is doing.",
                "Time in the market beats timing the market. I play the long game.",
                "Small amounts compound into life-changing sums. I start now, not later.",
                "I don't invest in what I don't understand. Boring beats clever."
            ]
        ),
        OnboardingTheme(
            title: "Generosity",
            principles: [
                "Give first, before I budget the rest. Generosity isn't leftovers.",
                "Hold money loosely—it's a tool, not a trophy. I own it; it doesn't own me.",
                "Use wealth to create impact beyond myself. Money is a means, not the end.",
                "I give without expecting return. Open hands receive more than clenched fists."
            ]
        ),
        OnboardingTheme(
            title: "Contentment",
            principles: [
                "I don't compare my finances to others. Their highlight reel isn't my life.",
                "Enough is a decision, not an amount. I choose to be content today.",
                "I celebrate progress, not perfection. Every step forward counts.",
                "Gratitude protects me from greed. I focus on what I have, not what I lack."
            ]
        )
    ]
    
    // MARK: - Family Themes
    
    static let familyThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Presence",
            principles: [
                "Phone down when family is around. They deserve my full attention.",
                "I show up mentally, not just physically. Being there isn't enough—being present is.",
                "When we're together, I'm not somewhere else in my head.",
                "Presence is the greatest gift I can give. It costs nothing but means everything."
            ]
        ),
        OnboardingTheme(
            title: "Time",
            principles: [
                "I guard our family calendar fiercely. Not everything deserves a yes.",
                "Family comes before work obligations. They won't remember my inbox, but they'll remember me.",
                "I say no to good things so I can say yes to the best things.",
                "Quantity time creates quality moments. You can't schedule magic."
            ]
        ),
        OnboardingTheme(
            title: "Traditions",
            principles: [
                "Traditions anchor our family identity. They're how we say 'this is who we are.'",
                "I invest in experiences over things. Memories outlast stuff.",
                "Small rituals become lifelong memories. Consistency creates belonging.",
                "We build stories worth retelling. Our family has a narrative."
            ]
        ),
        OnboardingTheme(
            title: "Peace",
            principles: [
                "I resolve conflict before the day ends. We don't let the sun go down on anger.",
                "I pursue peace, not just quiet. Silence isn't harmony.",
                "Reconciliation is always the goal. Being right matters less than being close.",
                "Our home is a refuge, not a battlefield."
            ]
        ),
        OnboardingTheme(
            title: "Expression",
            principles: [
                "I show love in their language, not mine. Love lands when it's understood.",
                "I say 'I love you' often, and I show it more.",
                "Consistent small acts beat grand gestures. Daily deposits matter.",
                "Physical affection is part of how we connect. Hugs aren't optional."
            ]
        )
    ]
    
    // MARK: - Marriage Themes
    
    static let marriageThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Communication",
            principles: [
                "Keep communication lines open—don't assume you know what your spouse is thinking or feeling.",
                "I share my thoughts before they fester. Silence breeds distance.",
                "Sometimes a hug and a listening ear communicate more love than advice.",
                "I speak up instead of shutting down. My voice matters in this marriage."
            ]
        ),
        OnboardingTheme(
            title: "Forgiveness",
            principles: [
                "Forgive quickly. And when I've made a mistake, admit it and humbly ask for forgiveness.",
                "I don't keep score. Resentment has no place in our home.",
                "We go to bed united, even when we disagree.",
                "I release grudges before they take root."
            ]
        ),
        OnboardingTheme(
            title: "Teamwork",
            principles: [
                "We are on the same team. Always. Every decision, every challenge—us against the problem.",
                "I try to be the biggest servant in the house. I don't keep score of who's doing more.",
                "In hard seasons, we take turns being strong for each other.",
                "I protect our team from outside voices that would divide us."
            ]
        ),
        OnboardingTheme(
            title: "Intimacy",
            principles: [
                "Make intimacy a priority. Our physical connection strengthens our emotional bond.",
                "I am intentional about spending time together doing things we both enjoy.",
                "I pursue my spouse, not just in the early days, but every day.",
                "I create space for us to connect without distractions."
            ]
        ),
        OnboardingTheme(
            title: "Faith",
            principles: [
                "Pray together. It's one of the most intimate acts we can share.",
                "Join a thriving community of faith that strengthens our marriage.",
                "We invite God into our decisions and struggles.",
                "Our marriage is built on something bigger than ourselves."
            ]
        ),
        OnboardingTheme(
            title: "Boundaries",
            principles: [
                "Surround yourself with friends who strengthen your marriage, not those who tear it down.",
                "I guard our marriage from relationships that could compromise our trust.",
                "I pick my battles wisely—not every issue is worth a fight.",
                "I protect our time together from the urgent demands of life."
            ]
        ),
        OnboardingTheme(
            title: "Expectations",
            principles: [
                "My spouse can never meet all my needs—they weren't designed to. I look to God and community too.",
                "I don't expect perfection. I married a human, not a fantasy.",
                "I release the spouse I imagined and embrace the one I have.",
                "I focus on what I can give, not what I'm not getting."
            ]
        ),
        OnboardingTheme(
            title: "Self-Awareness",
            principles: [
                "Use HALT: when I'm Hungry, Angry, Lonely, or Tired, I address that before difficult conversations.",
                "I recognize when I'm the problem and own it quickly.",
                "I don't make permanent decisions based on temporary emotions.",
                "I am a safe place for my spouse to feel all their feelings."
            ]
        )
    ]
    
    // MARK: - Parenting Themes
    
    static let parentingThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Example",
            principles: [
                "I model what I want to see. My actions teach more than my words ever could.",
                "They're watching everything, so I live it. I can't shout my way to good behavior.",
                "I become the person I want them to be. Character is caught, not taught.",
                "I let them see me fail and recover. That's the real lesson."
            ]
        ),
        OnboardingTheme(
            title: "Discipline",
            principles: [
                "Correction comes from a calm place. Anger teaches fear, not wisdom.",
                "I teach, not punish. The goal is growth, not compliance.",
                "Boundaries are an act of love. Structure creates security.",
                "I discipline behavior, not the child. They are not their mistakes."
            ]
        ),
        OnboardingTheme(
            title: "Listening",
            principles: [
                "I seek to understand before I seek to be understood.",
                "Their voice matters to me—even when they're wrong. I listen first.",
                "I create space for them to share without judgment or lectures.",
                "Sometimes they don't need solutions. They need to be heard."
            ]
        ),
        OnboardingTheme(
            title: "Independence",
            principles: [
                "I prepare them for the road, not the road for them. Struggle builds strength.",
                "I'm raising adults, not children. Independence is the goal.",
                "I let them fail when the stakes are low so they can succeed when they're high.",
                "My job is to work myself out of a job."
            ]
        ),
        OnboardingTheme(
            title: "Acceptance",
            principles: [
                "I celebrate who they are, not just what they do. Identity before achievement.",
                "My love isn't tied to their performance. They are enough as they are.",
                "I parent the child I have, not the child I imagined.",
                "They don't have to earn my delight. They already have it."
            ]
        ),
        OnboardingTheme(
            title: "Humility",
            principles: [
                "I apologize to my kids when I'm wrong. Humility is part of my parenting.",
                "I don't pretend to have all the answers. We figure it out together.",
                "Being wrong is okay; hiding it isn't. I show them how to own mistakes.",
                "I'm not a perfect parent, and I don't have to be."
            ]
        )
    ]
    
    // MARK: - Faith Themes
    
    static let faithThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Stillness",
            principles: [
                "I begin before the noise. Morning quiet anchors my soul for the day.",
                "I create space for stillness daily. God speaks in the silence.",
                "The first hour sets the tone. I give my best time, not my leftovers.",
                "I slow down enough to hear. Busyness is the enemy of intimacy with God."
            ]
        ),
        OnboardingTheme(
            title: "Trust",
            principles: [
                "Faith doesn't require all the answers. I rest in mystery.",
                "Uncertainty doesn't shake my foundation. My anchor holds.",
                "I trust the character of God when I can't trace His hand.",
                "Worry and worship cannot occupy the same space. I choose worship."
            ]
        ),
        OnboardingTheme(
            title: "Obedience",
            principles: [
                "My beliefs guide my choices. Sunday and Monday look the same.",
                "Faith is practical, not theoretical. I live what I say I believe.",
                "I obey even when I don't understand. Trust precedes insight.",
                "Small daily obedience matters more than occasional big moments."
            ]
        ),
        OnboardingTheme(
            title: "Community",
            principles: [
                "I don't walk alone. Faith grows in relationship with others.",
                "I show up to community even when I don't feel like it. Consistency builds connection.",
                "I let others see my real struggles. Vulnerability strengthens faith.",
                "I invest in a local church. Spectators don't grow."
            ]
        ),
        OnboardingTheme(
            title: "Gratitude",
            principles: [
                "I count blessings, not burdens. Thankfulness is my daily posture.",
                "Gratitude turns what I have into enough. It's the antidote to comparison.",
                "I notice the good around me, especially in hard seasons.",
                "I thank God in all circumstances—not for all circumstances."
            ]
        ),
        OnboardingTheme(
            title: "Scripture",
            principles: [
                "I read the Bible daily—not to check a box, but to hear from God.",
                "I meditate on truth until it shapes how I think and act.",
                "Scripture is my authority, not just my inspiration.",
                "I memorize verses that fight my specific battles."
            ]
        )
    ]
    
    // MARK: - Fitness Themes
    
    static let fitnessThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Movement",
            principles: [
                "Daily movement is non-negotiable. Something is always better than nothing.",
                "Motion is medicine. I move because I can, not because I have to.",
                "I don't need a gym to move my body. Movement is everywhere.",
                "The best workout is the one I'll actually do."
            ]
        ),
        OnboardingTheme(
            title: "Nutrition",
            principles: [
                "I eat to fuel my life, not just to fill my stomach.",
                "Food is information for my body. I choose what message I send.",
                "I choose nourishment over convenience. Fast food is slow death.",
                "What I eat today is how I'll feel tomorrow. Every bite is a choice."
            ]
        ),
        OnboardingTheme(
            title: "Recovery",
            principles: [
                "Rest is part of the plan—not cheating on the plan.",
                "Sleep is non-negotiable. Everything works better when I'm rested.",
                "Recovery is where growth happens. I don't skip it.",
                "I listen to my body's need for rest. Pushing through isn't always the answer."
            ]
        ),
        OnboardingTheme(
            title: "Consistency",
            principles: [
                "I show up even when I don't feel like it. Discipline beats motivation.",
                "Consistency beats intensity. I'd rather be steady than spectacular.",
                "Motivation follows action. I don't wait until I feel like it.",
                "Small daily wins compound into massive change over time."
            ]
        ),
        OnboardingTheme(
            title: "Progress",
            principles: [
                "I measure against yesterday's version of me. That's my only competition.",
                "Progress over perfection. Better is better than best.",
                "I celebrate small improvements. They compound into transformation.",
                "I track what matters so I can see how far I've come."
            ]
        ),
        OnboardingTheme(
            title: "Longevity",
            principles: [
                "I train so I can play with my grandkids. This is about the long game.",
                "I protect my joints, my back, my future self. Ego lifts today cost mobility tomorrow.",
                "Pain is information. I know the difference between hurt and harm.",
                "I want to be strong, mobile, and capable for decades."
            ]
        )
    ]
    
    // MARK: - Work Themes
    
    static let workThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Purpose",
            principles: [
                "Purpose drives my career. Meaning matters more than status.",
                "I work on what I believe in. Life's too short for soulless work.",
                "I find meaning in my work, or I find work with meaning.",
                "My work contributes to something bigger than a paycheck."
            ]
        ),
        OnboardingTheme(
            title: "Boundaries",
            principles: [
                "Work doesn't own me. I log off with intention.",
                "I protect my personal time fiercely. Boundaries make me better at my job.",
                "I don't check email during family time. They deserve my presence.",
                "I say no to protect my yes. Overcommitting serves no one."
            ]
        ),
        OnboardingTheme(
            title: "Reliability",
            principles: [
                "My word is my bond. If I say I'll do it, it gets done.",
                "I under-promise and over-deliver. Reliability is my reputation.",
                "I don't make excuses. I make progress or I own the delay.",
                "People can count on me. That's worth more than talent."
            ]
        ),
        OnboardingTheme(
            title: "Growth",
            principles: [
                "Learning never stops. I stay curious and teachable.",
                "I invest in my own development. No one else will do it for me.",
                "I seek feedback, even when it's uncomfortable. That's how I grow.",
                "I read, learn, and apply. Growth is part of the job."
            ]
        ),
        OnboardingTheme(
            title: "Leadership",
            principles: [
                "I lift others as I climb. Success includes helping others rise.",
                "I mentor and support colleagues. Knowledge shared is knowledge multiplied.",
                "I lead by example, whether or not I have the title.",
                "Credit flows down, responsibility flows up. That's how I lead."
            ]
        ),
        OnboardingTheme(
            title: "Excellence",
            principles: [
                "I do my best work even when no one's watching.",
                "Excellence is a habit, not an event. I bring it daily.",
                "I take pride in my craft. My name is on my work.",
                "Good enough isn't good enough when great is possible."
            ]
        )
    ]
    
    // MARK: - Friendships Themes
    
    static let friendshipsThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Initiative",
            principles: [
                "I reach out first. I don't wait for invitations to connect.",
                "I pursue my friendships actively. Relationships require effort.",
                "I schedule time with friends like I schedule important meetings.",
                "Connection requires initiative. I don't let friendships drift."
            ]
        ),
        OnboardingTheme(
            title: "Loyalty",
            principles: [
                "I show up when it's inconvenient. That's when it matters most.",
                "I don't disappear when things get tough. I lean in.",
                "I defend my friends when they're not in the room.",
                "I'm the kind of friend I want to have."
            ]
        ),
        OnboardingTheme(
            title: "Depth",
            principles: [
                "A few close friends over many acquaintances. Depth over breadth.",
                "I invest deeply in fewer people. Shallow friendships don't nourish.",
                "I share my real self, not a curated version.",
                "I ask the second question—the one that goes deeper."
            ]
        ),
        OnboardingTheme(
            title: "Honesty",
            principles: [
                "I'm honest even when it's hard. Real friends tell the truth.",
                "I say what needs to be said, gently. Truth and kindness aren't opposites.",
                "I'd rather have an uncomfortable conversation than a fake friendship.",
                "I speak into my friends' lives because I care, not because I judge."
            ]
        ),
        OnboardingTheme(
            title: "Celebration",
            principles: [
                "I'm not threatened by my friends' success. Their wins are my wins.",
                "I cheer loudly for my friends. Joy shared is joy multiplied.",
                "I celebrate their milestones like they're my own.",
                "Comparison is the thief of friendship. I refuse to compete."
            ]
        )
    ]
    
    // MARK: - Home Themes
    
    static let homeThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Peace",
            principles: [
                "My home is a sanctuary. Peace starts at the front door.",
                "I curate calm in my space. Environment shapes my mood.",
                "When I walk in, I feel relief—not stress. That's by design.",
                "The atmosphere of my home is my responsibility."
            ]
        ),
        OnboardingTheme(
            title: "Simplicity",
            principles: [
                "Less clutter, more clarity. I own less, but better.",
                "Everything has a place and a purpose. If it doesn't, it goes.",
                "I regularly purge what no longer serves us.",
                "Simplicity is freedom. Stuff is weight."
            ]
        ),
        OnboardingTheme(
            title: "Maintenance",
            principles: [
                "Prevention beats repair. Small efforts now prevent big costs later.",
                "I stay ahead of problems. Deferred maintenance always costs more.",
                "I fix things when they break—not 'someday.'",
                "I maintain before I upgrade. The basics matter most."
            ]
        ),
        OnboardingTheme(
            title: "Hospitality",
            principles: [
                "I open my doors generously. My home is for sharing.",
                "Hospitality doesn't require perfection. It requires presence.",
                "I'd rather have people over in a messy house than no one over in a perfect one.",
                "My home is a blessing to share, not a museum to protect."
            ]
        ),
        OnboardingTheme(
            title: "Routines",
            principles: [
                "Small disciplines create order. Routines run the house.",
                "I make my bed every morning. I start the day with a win.",
                "I clean as I go. Small habits prevent big messes.",
                "Tidiness reflects my mindset. Outer order supports inner calm."
            ]
        )
    ]
    
    // MARK: - Self Themes
    
    static let selfThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Worth",
            principles: [
                "I am enough without achieving. My worth isn't tied to productivity.",
                "My value is inherent, not earned. I don't have to prove myself.",
                "Rest is not laziness. I am allowed to stop.",
                "I reject the lie that I must be useful to be valuable."
            ]
        ),
        OnboardingTheme(
            title: "Self-Talk",
            principles: [
                "I speak to myself like I would speak to a friend.",
                "Self-compassion is strength, not weakness. I'm my own ally.",
                "I catch the inner critic and challenge it. I don't let it run unchecked.",
                "I treat myself with the grace I give others."
            ]
        ),
        OnboardingTheme(
            title: "Inputs",
            principles: [
                "I choose what enters my mind. What I consume shapes who I become.",
                "I curate my social media, news, and entertainment. Garbage in, garbage out.",
                "I protect my peace by guarding my attention.",
                "I read, listen to, and watch things that make me better."
            ]
        ),
        OnboardingTheme(
            title: "Boundaries",
            principles: [
                "Saying no is self-care. Boundaries protect my energy.",
                "I don't pour from an empty cup. I refill before I empty.",
                "My limits are not weaknesses. They're wisdom.",
                "I disappoint some people to take care of myself. That's okay."
            ]
        ),
        OnboardingTheme(
            title: "Growth",
            principles: [
                "Progress, not perfection. Better beats best.",
                "I embrace my imperfections. They're part of the journey.",
                "Growth is lifelong. I'm not behind—I'm on my way.",
                "I learn from failure without letting it define me."
            ]
        ),
        OnboardingTheme(
            title: "Joy",
            principles: [
                "I prioritize what fills me up. Joy is not frivolous—it's fuel.",
                "Hobbies aren't optional. I need things that are just for me.",
                "I schedule soul care. It doesn't happen by accident.",
                "I give myself permission to play. Fun is not just for kids."
            ]
        )
    ]
    
    // MARK: - Default Themes (for custom pillars)
    
    static let defaultThemes: [OnboardingTheme] = [
        OnboardingTheme(
            title: "Intentionality",
            principles: [
                "I spend time on what matters. I don't drift through days.",
                "Every hour has purpose. Time is my most precious resource.",
                "I act with intention, not just reaction.",
                "I live on purpose, not by accident."
            ]
        ),
        OnboardingTheme(
            title: "Resilience",
            principles: [
                "Failure is feedback. I grow through setbacks.",
                "Mistakes are teachers. I fail forward.",
                "I don't let one bad day define my week.",
                "Resilience is built through adversity, not despite it."
            ]
        ),
        OnboardingTheme(
            title: "Curiosity",
            principles: [
                "I never stop learning. Questions lead to growth.",
                "I embrace not knowing. Curiosity keeps me alive.",
                "I stay a student, no matter how much I know.",
                "I ask more than I tell."
            ]
        ),
        OnboardingTheme(
            title: "Ownership",
            principles: [
                "I don't blame circumstances. I am responsible for my life.",
                "I own my decisions and their consequences.",
                "My choices shape my outcomes. I choose wisely.",
                "I can't control everything, but I control my response."
            ]
        ),
        OnboardingTheme(
            title: "Integrity",
            principles: [
                "My actions match my beliefs. I walk the talk.",
                "I do what's right, not what's easy.",
                "Integrity is non-negotiable. Character over convenience.",
                "I am the same person in public and in private."
            ]
        )
    ]
}
