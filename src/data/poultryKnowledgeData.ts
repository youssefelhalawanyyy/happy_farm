export interface PoultryTopic {
  title: string;
  content: string;
}

export interface PoultryKnowledgeCategory {
  category: string;
  topics: PoultryTopic[];
}

export const poultryKnowledgeData: PoultryKnowledgeCategory[] = [
  {
    category: "Farm Planning",
    topics: [
      {
        title: "Farm Layout",
        content:
          "Broiler farms should separate poultry houses by at least 1.5 to 2 times the width of the buildings to maintain good airflow and biosecurity."
      },
      {
        title: "Biosecurity",
        content:
          "Access to poultry farms must be restricted. Visitors should change clothing and footwear before entering production areas."
      },
      {
        title: "Farm Cycle",
        content:
          "A broiler production cycle typically includes 35 days of growout followed by 10-14 days of cleaning and preparation before the next batch."
      }
    ]
  },
  {
    category: "Broiler Housing",
    topics: [
      {
        title: "Ventilation Systems",
        content:
          "Broiler houses must maintain proper airflow to remove excess heat, moisture, ammonia, and carbon dioxide."
      },
      {
        title: "Lighting",
        content: "Lighting programs help control bird activity and growth rate."
      },
      {
        title: "Stocking Density",
        content: "Typical stocking density is around 15 birds per square meter depending on farm design."
      }
    ]
  },
  {
    category: "Brooding Management",
    topics: [
      {
        title: "Day-Old Chick Temperature",
        content: "Day-old chicks require temperatures between 32°C and 34°C at bird level."
      },
      {
        title: "Temperature Reduction",
        content: "Temperature should gradually decrease each week until it reaches about 21-25°C."
      },
      {
        title: "Relative Humidity",
        content: "Recommended humidity during brooding is 50-65%."
      }
    ]
  },
  {
    category: "Feeding and Nutrition",
    topics: [
      {
        title: "Starter Feed",
        content:
          "Starter feed is provided during the first two weeks and contains high protein for rapid growth."
      },
      {
        title: "Grower Feed",
        content: "Grower feed supports muscle development during the mid-growth stage."
      },
      {
        title: "Finisher Feed",
        content: "Finisher feed is used during the final growth stage before market."
      },
      {
        title: "Feed Conversion Ratio",
        content: "FCR = total feed consumed divided by weight gained."
      }
    ]
  },
  {
    category: "Water Management",
    topics: [
      {
        title: "Water Consumption",
        content: "Water intake increases with age and temperature."
      },
      {
        title: "Drinker Systems",
        content: "Common drinker systems include nipple drinkers, bell drinkers, and cup drinkers."
      }
    ]
  },
  {
    category: "Growth Monitoring",
    topics: [
      {
        title: "Body Weight Tracking",
        content: "Chickens should be weighed weekly to monitor growth performance."
      },
      {
        title: "Performance Index",
        content: "Performance index combines body weight and feed efficiency to evaluate production."
      }
    ]
  },
  {
    category: "Environmental Control",
    topics: [
      {
        title: "Temperature Control",
        content:
          "Broilers are sensitive to temperature. Low temperatures increase feed consumption while high temperatures reduce growth."
      },
      {
        title: "Ventilation",
        content: "Ventilation removes excess heat and maintains air quality."
      },
      {
        title: "Moisture Control",
        content: "Wet litter causes ammonia buildup and health problems."
      }
    ]
  },
  {
    category: "Poultry Health",
    topics: [
      {
        title: "Vaccination",
        content:
          "Vaccination protects birds from major viral diseases such as Newcastle disease and infectious bronchitis."
      },
      {
        title: "Disease Prevention",
        content: "Proper hygiene, vaccination, and biosecurity help prevent disease outbreaks."
      }
    ]
  }
];

export interface ResearchPaper {
  title: string;
  description: string;
  pdfLink: string;
}

export const poultryResearchPapers: ResearchPaper[] = [
  {
    title: "Broiler Performance Under Different Stocking Densities",
    description: "Comparative review of growth rate, feed conversion, and welfare outcomes.",
    pdfLink: "https://www.scielo.br/j/rbca/a/4ScW5N5C6JXgX5Xx9f3FQdz/?format=pdf&lang=en"
  },
  {
    title: "Ventilation and Air Quality in Modern Broiler Houses",
    description: "Practical implications of airflow management on ammonia and heat stress.",
    pdfLink: "https://www.mdpi.com/2076-2615/13/13/2143/pdf"
  },
  {
    title: "Nutrition Strategies for Improving Feed Conversion in Broilers",
    description: "Evidence-based feeding phases and nutrient density recommendations.",
    pdfLink: "https://www.mdpi.com/2076-2615/12/23/3352/pdf"
  }
];
