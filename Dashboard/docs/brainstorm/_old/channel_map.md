Currently, for a user to upload a file or batch of files they need to include a channel_map.yml file that specifies which columns of the rsp converted .csv file maps to which plot and plot axis. See below the heirarcichal channel map for a program "201476" and version "v04_data_processing" that shows which column in the .csv file maps to the x_col and y_col for a specific plot. 

"201476":
  "v04_data_processing":
    bj_xy_force_plot:
      x_col: 2
      y_col: 3
    bj_xz_force_plot:
      x_col: 2
      y_col: 4
    shock_xy_force_plot:
      x_col: 20
      y_col: 21
    shock_xz_force_plot:
      x_col: 20
      y_col: 22
    bushing_f_xy_force_plot:
      x_col: 8
      y_col: 9
    bushing_f_xz_force_plot:
      x_col: 8
      y_col: 10
    bushing_r_xy_force_plot:
      x_col: 14
      y_col: 15
    bushing_r_xz_force_plot:
      x_col: 14
      y_col: 16


I now want to add the functionality to simply upload .csv files or file without the need for a channel_map.yml file. IF a channel map file is included, proceed with the regular upload extraction and insertion workflow. I NOW want to expand the upload flow/pipeline to first detect a missing channel_map.yml, BUT still i want this to be visible in the database upload heirarchical table page WITH a small, subtle red exclamation inscribed in a circle icon to the immediate left of the program version (also roll-up this icon to the program id IF ATLEAST one program version has this icon - this will notify the user that they need to maully specify the channel map.)  NOTE that i still to run the .rsp to .csv file conversion IF rsp files are uploaded with out the channel map.  

For the programs that do not have a channel map, allow the user to manual define the channel maps. USer should be able to do this from the Edit Filters page. REPLACE the current placeholder "Custom Fields" tab with a minimal 2-page layout with equal width right and leftside panels. On the left panel the user will be able to fill in the column value for a table that exposes the following 

bj_xy_force_plot:
  x_col: 2
  y_col: 3
bj_xz_force_plot:
  x_col: 2
  y_col: 4
shock_xy_force_plot:
  x_col: 20
  y_col: 21
shock_xz_force_plot:
  x_col: 20
  y_col: 22
bushing_f_xy_force_plot:
  x_col: 8
  y_col: 9
bushing_f_xz_force_plot:
  x_col: 8
  y_col: 10
bushing_r_xy_force_plot:
  x_col: 14
  y_col: 15
bushing_r_xz_force_plot:
  x_col: 14
  y_col: 16

On the right hand panel display the first 20 lines of the FIRST .csv file in the corresponding  program id > version > first .csv file. THESE first 20 lines will consit of the colum headers titles units datatyes followed by few lines of the table data TO DESIGN THE FRONT END rely on the following REFERNCE CODE: .references/client-side-table-code



SEE INSPECT DAMAGE COLUMN MAP

BJ X Force - x_col: 2
BJ Y Force - y_col: 3
BJ Z Force - y_col: 4

Shock X Force - x_col: 20
Shock Y Force - y_col: 21
Shock Z Force - y_col: 22

Bushing F X Momt - x_col: 8
Bushing F Y Momt - y_col: 9
Bushing F Z Momt - y_col: 10

Bushing R X Momt - x_col: 14
Bushing R Y Momt - y_col: 15
Bushing R Z Momt - y_col: 16
