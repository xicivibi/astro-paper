let S=Excel.CurrentWorkbook(){[Name="Input"]}[Content] in Table.UnpivotOtherColumns(S,{"ID","Team","Item"},"Month","Amount")
