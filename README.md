# MAG Performance Visual Analytics Dashboard

This project presents an interactive **Visual Analytics dashboard** for the analysis of **Men’s Artistic Gymnastics (MAG)** performances in **World and European Championships** from **2022 to 2024**.  
The system supports exploratory analysis, comparison, and interpretation of performance data through multiple coordinated visualizations and interactive techniques.

## Project Goals

- Analyze artistic gymnastics performances across competitions, years, and apparatuses  
- Compare Difficulty, Execution, and Final Scores at different levels of detail  
- Identify performance trends, variability, and consistency  
- Explore similarities between athletes using dimensionality reduction techniques  
- Support both overview-level analysis and details-on-demand exploration  

## Dataset Description

The dataset contains individual performance records from official World and European Championships.

Each record includes:

- Athlete  
- Nation  
- Competition (World / European Championships)  
- Event and Event Date  
- Year  
- Apparatus (FX, PH, SR, VT, PB, HB)  
- Difficulty score (D-score)  
- Execution score (E-score)  
- Penalties  
- Final Score  
- Qualification status (Qualified / Reserve / Not Qualified)  
- Rank  

### Data Preprocessing

- Records with missing or non-informative attributes were removed  
- Only variables relevant to performance analysis were retained  
- Categorical fields were cleaned and standardized  
- The final dataset contains several thousand clean observations  

## Visual Analytics Dashboard

The dashboard integrates four coordinated visualizations:

### 1. Scatter Plot (D vs E)
- Shows the relationship between Difficulty and Execution scores  
- Points represent athlete performances  
- Color encodes qualification status  

### 2. Performance Trend View
- **Multi-year:** dot–interval visualization (mean, min–max) to show temporal trends  
- **Single-year:** event-level dot–interval comparison  
- Enables comparison between World and European Championships  

### 3. Heatmap
- Displays average Final Scores using color intensity  
- Organized by apparatus and temporal dimension (year or event)  
- Supports quick pattern detection and comparison  

### 4. PCA Projection
- Applies Principal Component Analysis to multidimensional performance data  
- Projects performances into a 2D space  
- Proximity indicates similarity in overall performance profiles  

## Interaction Techniques

- Filtering by year, apparatus, athlete, nation, and qualification status  
- Hover interactions for details-on-demand  
- Selection of athletes and events  
- Brushing for coordinated filtering  
- Linked views across all visualizations  

## Data Analytics

- Aggregation of performance data (mean, min, max)  
- Comparative analysis across competitions and apparatuses  
- Exploration of variability and consistency  
- Dimensionality reduction through PCA  

## Intended Users

- Coaches and technical staff  
- Performance analysts and researchers  
- Athletes interested in performance comparison  
- Federation staff for high-level monitoring  

## Application Scenarios

- Comparing athlete performances across competitions and years  
- Analyzing apparatus-specific strengths and weaknesses  
- Identifying performance consistency and variability  
- Exploring similarities between athletes  

## Technologies Used

- JavaScript (ES6 modules)  
- D3.js v7  
- HTML5 / CSS3  

## Future Work

- Extension to additional competitions and Olympic cycles  
- Integration of routine-level or biomechanical data  
- Advanced analytical or predictive techniques  
- User-centered evaluation with domain experts  

## Academic Context

This project was developed as part of a **Visual Analytics course** and focuses on applying interactive visualization techniques to a sports analytics domain that is still largely underexplored in existing literature.
